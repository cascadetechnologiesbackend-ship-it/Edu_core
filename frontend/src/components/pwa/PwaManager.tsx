"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, Download, X } from "lucide-react";

export function PwaManager() {
  const [isOffline, setIsOffline] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // 1. Online / Offline listeners
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    // 2. Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // If a new worker is waiting
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setUpdateAvailable(true);
          }

          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            if (installing) {
              installing.addEventListener("statechange", () => {
                if (installing.state === "installed" && navigator.serviceWorker.controller) {
                  setWaitingWorker(installing);
                  setUpdateAvailable(true);
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration skipped:", err);
        });

      // Handle controllerchange reload
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    // 3. Install prompt interception (Spec 3.3)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Show install banner once if not dismissed
      const dismissed = localStorage.getItem("edu.pwa.install_dismissed");
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleUpdateReload = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  };

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstallBanner(false);
    }
    setInstallPrompt(null);
  };

  const handleDismissInstall = () => {
    setShowInstallBanner(false);
    try {
      localStorage.setItem("edu.pwa.install_dismissed", "true");
    } catch {}
  };

  return (
    <>
      {/* Offline Toast Banner */}
      {isOffline && (
        <div
          role="alert"
          className="fixed top-0 left-0 right-0 z-[100000] bg-amber-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-md animate-fade-in"
        >
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>You are currently offline. Edits and financial operations are paused to protect record integrity.</span>
        </div>
      )}

      {/* SW Update Toast */}
      {updateAvailable && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-[99999] bg-slate-900 border border-indigo-500/50 text-white p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in max-w-sm"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <RefreshCw className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-semibold text-sm">Update Available</p>
            <p className="text-slate-400">A new version of SchoolMitra ERP is ready.</p>
          </div>
          <button
            onClick={handleUpdateReload}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex-shrink-0"
          >
            Reload
          </button>
        </div>
      )}

      {/* Install PWA Prompt Banner */}
      {showInstallBanner && installPrompt && (
        <div
          role="dialog"
          className="fixed bottom-4 left-4 z-[99999] bg-slate-900 border border-white/10 text-white p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in max-w-sm"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Download className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-semibold text-sm">Install SchoolMitra</p>
            <p className="text-slate-400">Install as a desktop or mobile application for instant access.</p>
          </div>
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex-shrink-0"
          >
            Install
          </button>
          <button
            onClick={handleDismissInstall}
            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}
