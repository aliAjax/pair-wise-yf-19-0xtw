import { createContext, useContext, useSyncExternalStore } from "react";
import { ReactNode, useCallback } from "react";

interface RouterValue {
  path: string;
  navigate: (to: string | number) => void;
}

const RouterContext = createContext<RouterValue>({
  path: "/queue",
  navigate: () => {},
});

function currentPath(): string {
  const h = window.location.hash.replace(/^#/, "");
  return h || "/queue";
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const path = useSyncExternalStore(
    useCallback((onChange: () => void) => {
      window.addEventListener("hashchange", onChange);
      return () => window.removeEventListener("hashchange", onChange);
    }, []),
    currentPath,
    currentPath,
  );

  const navigate = useCallback((to: string | number) => {
    if (typeof to === "number") {
      window.history.go(to);
      return;
    }
    if (!to.startsWith("/")) to = `/${to}`;
    if (currentPath() === to) return;
    window.location.hash = to;
  }, []);

  return (
    <RouterContext.Provider value={{ path, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter(): RouterValue {
  return useContext(RouterContext);
}

export function useNavigate(): (to: string | number) => void {
  return useRouter().navigate;
}

export function usePath(): string {
  return useRouter().path;
}
