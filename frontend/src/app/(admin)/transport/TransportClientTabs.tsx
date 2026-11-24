"use client";

import { useState, useEffect } from "react";
import VehiclesTab from "./VehiclesTab";
import DriversTab from "./DriversTab";
import RoutesStopsTab from "./RoutesStopsTab";
import BusPassesTab from "./BusPassesTab";
import GPSTrackingTab from "./GPSTrackingTab";

export default function TransportClientTabs({
  vehicles,
  driversList = [],
  routesList,
  passes,
  students,
  role,
  userId,
  isAdmin,
}: {
  vehicles: any[];
  driversList?: any[];
  routesList: any[];
  passes: any[];
  students: any[];
  role: string;
  userId: string;
  isAdmin: boolean;
}) {
  const [activeTab, setActiveTab] = useState("vehicles");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("transport_tab");
      if (saved) {
        setActiveTab(saved);
      }
    } catch {}
  }, []);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    try {
      localStorage.setItem("transport_tab", tabId);
    } catch {}
  };

  const tabs = [
    { id: "vehicles", label: "Vehicles" },
    { id: "drivers", label: "Drivers & Accounts" },
    { id: "routes", label: "Routes & Stops" },
    { id: "passes", label: "Bus Passes" },
    { id: "gps", label: "Live GPS Tracking" },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Selectors - Apple Inset Segmented Control */}
      <div className="bg-muted/40 p-1.5 rounded-2xl border border-border/40 inline-flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center ${
              activeTab === tab.id
                ? "bg-card text-[#D97706] dark:text-[#FF9F0A] shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground border border-transparent"
            }`}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="transition-all duration-150">
        {activeTab === "vehicles" && (
          <VehiclesTab vehicles={vehicles} isAdmin={isAdmin} />
        )}
        {activeTab === "drivers" && (
          <DriversTab
            driversList={driversList}
            vehiclesList={vehicles}
            isAdmin={isAdmin}
          />
        )}
        {activeTab === "routes" && (
          <RoutesStopsTab
            routesList={routesList}
            vehicles={vehicles}
            isAdmin={isAdmin}
          />
        )}
        {activeTab === "passes" && (
          <BusPassesTab
            passes={passes}
            students={students}
            routes={routesList}
            isAdmin={isAdmin}
          />
        )}
        {activeTab === "gps" && <GPSTrackingTab routes={routesList} />}
      </div>
    </div>
  );
}
