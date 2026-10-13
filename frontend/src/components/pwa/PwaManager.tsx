"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  WifiOff,
  RefreshCw,
  Download,
  X,
  Smartphone,
  Share2,
  PlusSquare,
  Sparkles,
  Zap,
  ShieldCheck,
  Check,
} from "lucide-react";

export function PwaManager() {
  const pathname = usePathname();
  const [isOffline, setIsOffline] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);
  const [showManualTip, setShowManualTip] = useState(false);

  useEffect(() => {
    // 1. Online / Offline listeners
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    // 2. Detect device & standalone state
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent || "";
      const isIosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      const isMobileDevice =
        /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
        window.innerWidth <= 820;
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes("android-app://");

      setIsIos(isIosDevice);
      setIsMobile(isMobileDevice);
      setIsStandalone(standalone);

      const installed =
        localStorage.getItem("edu.pwa.installed") === "true" ||
        sessionStorage.getItem("edu.pwa.installed") === "true";
      setIsInstalled(installed);
    }

    // 3. Register Service Worker (Production Only)
    const isDev =
      process.env.NODE_ENV !== "production" ||
      (typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1" ||
          window.location.hostname === "[::1]"));

    if (isDev) {
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().then((unregistered) => {
              if (unregistered) {
                console.info("[PWA] Unregistered development Service Worker:", registration.scope);
              }
            });
          }
        });
        if ("caches" in window) {
          caches.keys().then((keys) => {
            for (const key of keys) {
              caches.delete(key);
            }
          });
        }
      }
    } else if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
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

      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    // 4. Install prompt interception
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Auto-trigger direct modal when install prompt is ready on mobile
      const dismissed = sessionStorage.getItem("edu.pwa.modal_dismissed") === "true";
      if (!dismissed) {
        setShowInstallModal(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallModal(false);
      localStorage.setItem("edu.pwa.installed", "true");
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Show modal on mobile device when not standalone
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone || isInstalled) {
      setShowInstallModal(false);
      return;
    }

    const dismissed = sessionStorage.getItem("edu.pwa.modal_dismissed") === "true";
    if (dismissed) return;

    let timer: NodeJS.Timeout | undefined;
    if (isMobile) {
      timer = setTimeout(() => {
        setShowInstallModal(true);
      }, 1200);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [pathname, isMobile, isStandalone, isInstalled]);

  const handleUpdateReload = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  };

  const handleInstallClick = async () => {
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === "accepted") {
          setIsInstalled(true);
          setShowInstallModal(false);
          localStorage.setItem("edu.pwa.installed", "true");
        }
      } catch (err) {
        console.warn("PWA prompt error:", err);
      }
      setInstallPrompt(null);
      return;
    }

    if (isIos) {
      setShowIosTip(true);
      setShowManualTip(false);
      return;
    }

    // Android/Desktop without native event ready yet
    setShowManualTip(true);
    setShowIosTip(false);
  };

  const handleDismissModal = () => {
    setShowInstallModal(false);
    sessionStorage.setItem("edu.pwa.modal_dismissed", "true");
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
          <span>You are currently offline. Edits are queued to protect records.</span>
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

      {/* ─── Direct PWA Install Pop-Up (Clean, Direct Action, Zero Long Instructions) ─── */}
      {showInstallModal && !isStandalone && !isInstalled && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 via-slate-900 to-[#0b101b] border border-indigo-500/30 rounded-3xl p-6 shadow-2xl space-y-5 text-white">
            {/* Top Close Button */}
            <button
              onClick={handleDismissModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* App Branding & Icon */}
            <div className="text-center pt-2 space-y-3">
              <div className="relative inline-block">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-xl shadow-indigo-600/30 border border-indigo-400/30">
                  <Smartphone className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-1 shadow-md border-2 border-slate-900">
                  <Zap className="w-3.5 h-3.5 text-white" />
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">
                  SchoolMitra ERP
                </h2>
                <p className="text-xs text-indigo-300 font-medium">
                  Official School Management App
                </p>
              </div>

              {/* Value Badges */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800/80 border border-slate-700/60 text-slate-300">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Instant Access
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800/80 border border-slate-700/60 text-slate-300">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  DPDP Protected
                </span>
              </div>
            </div>

            {/* iOS Instant Cue (Only shown when user taps install on iOS) */}
            {showIosTip && (
              <div className="rounded-xl bg-indigo-950/70 border border-indigo-500/40 p-3 text-center text-xs text-indigo-200 animate-in fade-in space-y-1">
                <div className="flex items-center justify-center gap-1.5 font-semibold text-white">
                  <span>Tap Safari</span>
                  <Share2 className="w-4 h-4 text-sky-400 inline" />
                  <span>Share ➔ Add to Home Screen</span>
                  <PlusSquare className="w-4 h-4 text-emerald-400 inline" />
                </div>
              </div>
            )}

            {/* Android Menu Cue (Only shown if browser hasn't fired beforeinstallprompt) */}
            {showManualTip && (
              <div className="rounded-xl bg-indigo-950/70 border border-indigo-500/40 p-3 text-center text-xs text-indigo-200 animate-in fade-in">
                <span>Tap <strong className="text-white">⋮ (Menu)</strong> in your browser and select <strong className="text-indigo-300">&quot;Install app&quot;</strong></span>
              </div>
            )}

            {/* Direct Actions */}
            <div className="space-y-2.5 pt-1">
              <button
                onClick={handleInstallClick}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/40 flex items-center justify-center gap-2.5 transition active:scale-[0.98] border border-indigo-400/30"
              >
                <Download className="w-4 h-4" />
                <span>Install App</span>
              </button>

              <button
                onClick={handleDismissModal}
                className="w-full py-2.5 px-4 text-slate-400 hover:text-slate-200 text-xs font-semibold transition text-center"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Discrete Floating Install Button on Mobile (When modal is dismissed) ─── */}
      {!showInstallModal && !isStandalone && !isInstalled && isMobile && (
        <button
          onClick={() => setShowInstallModal(true)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[99990] flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/95 border border-indigo-500/40 text-white shadow-xl shadow-black/50 text-xs font-semibold backdrop-blur-md active:scale-95 transition hover:border-indigo-400 hover:bg-slate-800"
        >
          <Download className="w-3.5 h-3.5 text-indigo-400" />
          <span>Install App</span>
        </button>
      )}
    </>
  );
}
