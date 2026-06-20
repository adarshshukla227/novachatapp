import React from "react";
import AsideBar from "./aside-bar";

interface Props {
  children: React.ReactNode;
}

const AppWrapper = ({ children }: Props) => {
  return (
    <div className="h-full">
      <AsideBar />
      {/* ✅ main-content class CSS se aati hai — sidebar ke barabar padding */}
      <main className="main-content">{children}</main>
    </div>
  );
};

export default AppWrapper;
