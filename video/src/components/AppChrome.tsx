import React from "react";
import { DARK, FONT_FAMILY, GRAY_200, WHITE, YELLOW } from "../tokens";

interface Props {
  activePage?: "studio" | "companies" | "articles";
}

const NavLink: React.FC<{
  label: string;
  icon: string;
  active: boolean;
}> = ({ label, icon, active }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 16px",
      borderRadius: 6,
      background: active ? YELLOW : "transparent",
      color: active ? DARK : "#666",
      fontSize: 14,
      fontWeight: active ? 600 : 500,
      cursor: "pointer",
      border: active ? "none" : `1px solid ${GRAY_200}`,
    }}
  >
    <span>{icon}</span>
    <span>{label}</span>
  </div>
);

export const AppChrome: React.FC<Props> = ({ activePage = "studio" }) => (
  <div
    style={{
      width: "100%",
      background: WHITE,
      borderBottom: `1px solid ${GRAY_200}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 48px",
      fontFamily: FONT_FAMILY,
      boxSizing: "border-box",
    }}
  >
    {/* Wordmark */}
    <div
      style={{
        fontSize: 20,
        fontWeight: 700,
        color: DARK,
        letterSpacing: "-0.03em",
      }}
    >
      AutoMouse
    </div>

    {/* Nav */}
    <div style={{ display: "flex", gap: 8 }}>
      <NavLink icon="✦" label="Studio" active={activePage === "studio"} />
      <NavLink icon="🏢" label="Companies" active={activePage === "companies"} />
      <NavLink icon="📄" label="Articles" active={activePage === "articles"} />
    </div>
  </div>
);
