import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { emailAccountService } from "@uptool/services";

interface OAuthState {
  orgId: string;
  userId: string;
  orgSlug: string;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !stateParam) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  let state: OAuthState;
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
  } catch {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  const { orgId, userId, orgSlug } = state;
  const settingsUrl = `/${orgSlug}/settings/email-accounts`;

  const clientId = process.env.AUTH_GOOGLE_ID ?? "";
  const clientSecret = process.env.AUTH_GOOGLE_SECRET ?? "";
  const redirectUri = process.env.GOOGLE_GMAIL_REDIRECT_URI ?? "";

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      console.error("Gmail token exchange failed:", await tokenRes.text());
      return NextResponse.redirect(new URL(`${settingsUrl}?error=token_exchange`, req.url));
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    // Get user email from Google
    const meRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const me = (await meRes.json()) as { email?: string; name?: string };
    const email = (me.email ?? "").toLowerCase();

    if (!email) {
      return NextResponse.redirect(new URL(`${settingsUrl}?error=no_email`, req.url));
    }

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : undefined;

    await emailAccountService.connect({
      orgId,
      userId,
      provider: "gmail",
      email,
      displayName: me.name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    });

    return NextResponse.redirect(new URL(`${settingsUrl}?connected=1`, req.url));
  } catch (err) {
    console.error("Gmail OAuth callback error:", err);
    return NextResponse.redirect(new URL(`${settingsUrl}?error=server`, req.url));
  }
}
