import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import { StoreProvider, useStore } from "./store";
import type { ToastItem } from "./components/ui";
import { ToastHost, makeToastApi } from "./components/ui";
import { RegisterView } from "./views/RegisterView";
import { QueueView } from "./views/QueueView";
import { ReviewView } from "./views/ReviewView";
import { LocalityView } from "./views/LocalityView";
import { ShelfView } from "./views/ShelfView";
import { DetailView } from "./views/DetailView";
import { photoComplete, stageOf } from "./utils";

type Tab = "queue" | "register" | "review" | "locality" | "shelf";

const TABS: { key: Tab; label: string }[] = [
  { key: "queue", label: "补照队列" },
  { key: "register", label: "登记 / 压制" },
  { key: "review", label: "鉴定筛选" },
  { key: "locality", label: "地点信息卡" },
  { key: "shelf", label: "柜位记录" },
];

const toast = makeToastApi();

function parseHash():
  | { name: "tab"; tab: Tab }
  | { name: "detail"; id: string } {
  const h = window.location.hash;
  const m = h.match(/^#\/specimen\/([^/?]+)/);
  if (m) return { name: "detail", id: decodeURIComponent(m[1]) };
  const tab = (h.replace(/^#\/?/, "") || "queue") as Tab;
  const valid = TABS.some((t) => t.key === tab);
  return { name: "tab", tab: valid ? tab : "queue" };
}

function Workbench() {
  const store = useStore();
  const { specimens, ready, operator, setOperator } = store;
  const [route, setRoute] = useState(parseHash());
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    toast.bind(setToasts);
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const goTab = (tab: Tab) => {
    window.location.hash = `#/${tab}`;
  };
  const goDetail = (id: string) => {
    window.location.hash = `#/specimen/${id}`;
  };

  const stats = useMemo(() => {
    const c = { pressing: 0, queue: 0, review: 0, approved: 0, shelved: 0 };
    for (const sp of specimens) {
      const st = stageOf(sp);
      if (st === "pressing") c.pressing += 1;
      else if (st === "shelved") c.shelved += 1;
      else if (st === "approved") c.approved += 1;
      else {
        c.queue += 1;
        if (photoComplete(sp) && !sp.returns.some((r) => !r.resolved))
          c.review += 1;
      }
    }
    return c;
  }, [specimens]);

  if (!ready) {
    return (
      <div className="boot">
        <div className="boot-card">🌿 正在打开本地标本数据库…</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">🌿</span>
          <div>
            <h1>植物标本馆 · 补照工作台</h1>
            <p>整株 / 标签 / 生境三类照片齐全，鉴定通过方可上柜</p>
          </div>
        </div>
        <label className="operator">
          <span>当前操作人</span>
          <input
            value={operator}
            placeholder="填写姓名"
            onChange={(e) => setOperator(e.target.value)}
          />
        </label>
      </header>

      <section className="metrics">
        <Metric label="压制中" value={stats.pressing} tone="amber" />
        <Metric label="补照队列" value={stats.queue} tone="blue" />
        <Metric label="待鉴定" value={stats.review} tone="teal" />
        <Metric label="待上柜" value={stats.approved} tone="green" />
        <Metric label="已上柜" value={stats.shelved} tone="ink" />
      </section>

      <nav className="tabs">
        {TABS.map((t) => {
          const active = route.name === "tab" && route.tab === t.key;
          return (
            <button
              key={t.key}
              className={active ? "tab tab-active" : "tab"}
              onClick={() => goTab(t.key)}
            >
              {t.label}
              {t.key === "queue" && stats.queue > 0 && (
                <span className="tab-dot">{stats.queue}</span>
              )}
            </button>
          );
        })}
      </nav>

      <main className="content">
        {route.name === "detail" ? (
          <DetailView
            id={route.id}
            operator={operator}
            back={() => window.history.back()}
          />
        ) : route.tab === "register" ? (
          <RegisterView operator={operator} goDetail={goDetail} />
        ) : route.tab === "queue" ? (
          <QueueView operator={operator} goDetail={goDetail} />
        ) : route.tab === "review" ? (
          <ReviewView
            operator={operator}
            goDetail={goDetail}
            goShelf={() => goTab("shelf")}
          />
        ) : route.tab === "locality" ? (
          <LocalityView goDetail={goDetail} />
        ) : (
          <ShelfView
            operator={operator}
            goDetail={goDetail}
            notify={(text, kind) => toast.push(text, kind)}
          />
        )}
      </main>

      <footer className="foot">
        所有记录与照片均保存在本机浏览器（IndexedDB），队列 / 鉴定 / 地点卡 /
        柜位 / 详情页共用同一份数据，关闭重开可继续处理。
        <button
          className="foot-link"
          onClick={async () => {
            if (
              window.confirm(
                "重新写入内置演示数据？将把演示标本恢复为初始状态，不会产生重复记录（你登记的标本保留）。"
              )
            ) {
              await store.loadSeed();
              toast.push("演示数据已重置", "success");
            }
          }}
        >
          追加演示数据
        </button>
      </footer>

      <ToastHost
        toasts={toasts}
        onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <article className={`metric metric-${tone}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Workbench />
    </StoreProvider>
  );
}
