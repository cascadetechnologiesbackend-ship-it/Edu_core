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
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Info,
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
  const [isInstalledOrAcknowledged, setIsInstalledOrAcknowledged] = useState(false);

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
      const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || window.innerWidth <= 820;
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes("android-app://");

      setIsIos(isIosDevice);
      setIsMobile(isMobileDevice);
      setIsStandalone(standalone);

      const acknowledged =
        sessionStorage.getItem("edu.pwa.installed_or_acknowledged") === "true" ||
        localStorage.getItem("edu.pwa.installed_or_acknowledged") === "true";

      setIsInstalledOrAcknowledged(acknowledged);
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
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  // Show modal if user is on an authenticated page (post-login), on mobile/tablet, and hasn't installed yet
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isPublicAuthRoute =
      pathname === "/" ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/forgot-password") ||
      pathname.startsWith("/force-password-change") ||
      pathname.startsWith("/onboard");

    let timer: NodeJS.Timeout | undefined;

    // Only prompt after login on internal dashboards
    if (!isPublicAuthRoute && !isStandalone && isMobile && !isInstalledOrAcknowledged) {
      timer = setTimeout(() => {
        setShowInstallModal(true);
      }, 600); // Gentle delay after route transition
    } else {
      setShowInstallModal(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [pathname, isStandalone, isMobile, isInstalledOrAcknowledged]);

  const handleUpdateReload = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  };

  const handleNativeInstallClick = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") {
        setShowInstallModal(false);
        setIsInstalledOrAcknowledged(true);
        sessionStorage.setItem("edu.pwa.installed_or_acknowledged", "true");
        localStorage.setItem("edu.pwa.installed_or_acknowledged", "true");
      }
    } catch (err) {
      console.warn("PWA prompt error:", err);
    }
    setInstallPrompt(null);
  };

  const handleAcknowledgeAndProceed = () => {
    setShowInstallModal(false);
    setIsInstalledOrAcknowledged(true);
    try {
      sessionStorage.setItem("edu.pwa.installed_or_acknowledged", "true");
      localStorage.setItem("edu.pwa.installed_or_acknowledged", "true");
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

      {/* ─── Centered Mobile PWA Install Modal (Mid-Screen Pop-Up) ─────────────── */}
      {showInstallModal && !isStandalone && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-[#0b101b] border border-indigo-500/30 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5 text-white">
            {/* Top Badge & Close */}
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Mobile Installation Required</span>
              </div>
              <button
                onClick={handleAcknowledgeAndProceed}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                title="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Icon & Title */}
            <div className="text-center space-y-2 pt-2">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Install SchoolMitra ERP
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                For complete DPDP compliance, biometric access, and secure offline record management on your mobile device, please install the application to your home screen.
              </p>
            </div>

            {/* Interactive Install Guidance */}
            <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4 space-y-3">
              {installPrompt ? (
                /* Native BeforeInstallPrompt available (Chrome / Edge) */
                <div className="space-y-3 text-center">
                  <p className="text-xs text-slate-300">
                    Your browser supports one-tap installation:
                  </p>
                  <button
                    onClick={handleNativeInstallClick}
                    className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install App to Home Screen</span>
                  </button>
                </div>
              ) : isIos ? (
                /* iOS Safari instructions */
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="font-semibold text-white flex items-center gap-1.5 text-xs text-indigo-400">
                    <Info className="w-4 h-4" /> How to install on iPhone / iPad (Safari):
                  </div>
                  <ol className="space-y-2 pl-1 list-decimal list-inside text-slate-300 leading-normal">
                    <li>
                      Tap the <span className="font-semibold text-white">Share button</span>{" "}
                      <Share2 className="w-3.5 h-3.5 inline text-sky-400 mx-0.5" /> at the bottom of Safari.
                    </li>
                    <li>
                      Scroll down and tap{" "}
                      <span className="font-semibold text-white">Add to Home Screen</span>{" "}
                      <PlusSquare className="w-3.5 h-3.5 inline text-emerald-400 mx-0.5" />.
                    </li>
                    <li>
                      Tap <span className="font-semibold text-indigo-300">Add</span> in the top right to install.
                    </li>
                  </ol>
                </div>
              ) : (
                /* Android Chrome without native prompt (e.g. over HTTP) */
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="font-semibold text-white flex items-center gap-1.5 text-xs text-indigo-400">
                    <Info className="w-4 h-4" /> How to install on Android (Chrome / Browser):
                  </div>
                  <ol className="space-y-2 pl-1 list-decimal list-inside text-slate-300 leading-normal">
                    <li>
                      Tap the <span className="font-semibold text-white">three dots menu (⋮)</span> in the top right corner of Chrome.
                    </li>
                    <li>
                      Select <span className="font-semibold text-white">&quot;Install app&quot;</span> or{" "}
                      <span className="font-semibold text-white">&quot;Add to Home screen&quot;</span>.
                    </li>
                    <li>
                      Tap <span className="font-semibold text-indigo-300">&quot;Install&quot;</span> to add SchoolMitra to your phone.
                    </li>
                  </ol>
                  <p className="text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mt-2">
                    Note: Browsers require an SSL certificate (HTTPS) for automatic popups. Adding to home screen via Chrome menu installs the identical full-screen application.
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-1 flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={handleAcknowledgeAndProceed}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 border border-slate-700"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>I have installed / Continue to App</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
