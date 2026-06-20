import React from "react";
import AsideBar from "./aside-bar";

interface Props {
  children: React.ReactNode;
}

const AppWrapper = ({ children }: Props) => {
  return (
    <div className="h-full">
      <AsideBar />
      {/* 
        Mobile: sidebar w-14 (56px) → pl-14
        Desktop: sidebar w-11 (44px) → pl-10 (Tailwind lg:pl-10)
      */}
      <main className="pl-14 md:pl-10 h-full">{children}</main>
    </div>
  );
};

export default AppWrapper;
