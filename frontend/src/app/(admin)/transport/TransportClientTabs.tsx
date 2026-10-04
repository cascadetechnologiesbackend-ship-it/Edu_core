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
      {/* Tab Selectors */}
      <div className="border-b border-gray-200 dark:border-slate-800">
        <ul
          className="flex flex-wrap -mb-px text-sm font-medium text-center"
          role="tablist"
        >
          {tabs.map((tab) => (
            <li key={tab.id} className="mr-2" role="presentation">
              <button
                onClick={() => handleTabChange(tab.id)}
                className={`inline-block p-4 border-b-2 rounded-t-lg transition font-semibold ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-600 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
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
