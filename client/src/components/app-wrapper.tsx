import React from "react";
import AsideBar from "./aside-bar";

interface Props {
  children: React.ReactNode;
}

const AppWrapper = ({ children }: Props) => {
  return (
    <div className="h-full flex">
      <AsideBar />
      {/* sidebar ke baad baaki sari width */}
      <main className="flex-1 min-w-0 h-full overflow-hidden">
        {children}
      </main>
    </div>
  );
};

export default AppWrapper;
