"use client";

import { createContext, useContext, useState } from "react";

interface ContextValue {
  collapsed: boolean;
  setCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
}

const SidebarCollapseContext = createContext<ContextValue>({
  collapsed: false,
  setCollapsed: () => {},
});

export function SidebarCollapseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <SidebarCollapseContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarCollapseContext.Provider>
  );
}

export function useSidebarCollapse() {
  return useContext(SidebarCollapseContext);
}
