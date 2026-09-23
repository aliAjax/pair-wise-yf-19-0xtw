import { useState } from "react";
import "./styles.css";
import {
  EMPTY_STATE,
  cloneState,
  identifyingSpecimens,
  queueSpecimens,
  setCurrentUser,
  storedSpecimens,
} from "./domain";
import { mutate, replaceState, useStore, useUser } from "./store";
import { toast, toastResult, useToasts } from "./toast";
import { RouterProvider, useNavigate, usePath } from "./router";
import { buildSeedState } from "./seed";
import { cls } from "./utils";
import Register from "./views/Register";
import Queue from "./views/Queue";
import Identify from "./views/Identify";
import Locations from "./views/Locations";
import Cabinets from "./views/Cabinets";
import SpecimenDetail from "./views/SpecimenDetail";

const NAV = [
  { to: "/register", label: "标本登记", icon: "📝" },
  { to: "/queue", label: "补照队列", icon: "📸" },
  { to: "/identify", label: "鉴定筛选", icon: "🔬" },
  { to: "/locations", label: "地点信息卡", icon: "🗺️" },
  { to: "/cabinets", label: "柜位记录", icon: "🗄️" },
];

function UserBar() {
  const user = useUser();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user);
  if (editing) {
    return (
      <span className="userbar">
        <input
          className="user-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const res = mutate((d) => setCurrentUser(d, name));
              if (res.ok) setEditing(false);
              else toastResult(res, "");
            }
          }}
        />
        <button
          className="mini primary"
          onClick={() => {
            const res = mutate((d) => setCurrentUser(d, name));
            if (res.ok) setEditing(false);
            else toastResult(res, "");
          }}
        >
          确定
        </button>
      </span>
    );
  }
  return (
    <button className="userbar" title="点击切换当前工作人员" onClick={() => { setName(user); setEditing(true); }}>
      👤 {user} <small>（切换）</small>
    </button>
  );
}

function Shell() {
  const path = usePath();
  const navigate = useNavigate();
  const toasts = useToasts();
  const user = useUser();
  const queueCount = useStore((s) => queueSpecimens(s).length);
  const identifyCount = useStore((s) => identifyingSpecimens(s).length);
  const storedCount = useStore((s) => storedSpecimens(s).length);
  const totalCount = useStore((s) => Object.keys(s.specimens).length);
  const [confirmClear, setConfirmClear] = useState(false);

  const counts: Record<string, number> = {
    "/queue": queueCount,
    "/identify": identifyCount,
    "/cabinets": storedCount,
  };

  let view: React.ReactNode;
  let activeNav: string;
  if (path.startsWith("/specimen/")) {
    view = <SpecimenDetail id={path.slice("/specimen/".length)} />;
    activeNav = "";
  } else if (path === "/identify") {
    view = <Identify />;
    activeNav = "/identify";
  } else if (path === "/locations") {
    view = <Locations />;
    activeNav = "/locations";
  } else if (path === "/cabinets") {
    view = <Cabinets />;
    activeNav = "/cabinets";
  } else if (path === "/register") {
    view = <Register />;
    activeNav = "/register";
  } else {
    view = <Queue />;
    activeNav = "/queue";
  }

  function loadSeed() {
    const res = replaceState(buildSeedState());
    toastResult(res, "已载入演示数据");
  }

  function doClear() {
    const empty = cloneState(EMPTY_STATE);
    empty.currentUser = user;
    const res = replaceState(empty);
    if (res.ok) toast("已清空全部本地数据");
    else toastResult(res, "");
    setConfirmClear(false);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" onClick={() => navigate("/queue")}>
          <span className="brand-mark">植</span>
          <div>
            <h1>补照工作台</h1>
            <small>植物标本馆 · 压制标本入库</small>
          </div>
        </div>
        <div className="top-stats">
          <span><b>{totalCount}</b> 登记</span>
          <span><b>{queueCount}</b> 队列</span>
          <span><b>{identifyCount}</b> 待鉴定</span>
          <span><b>{storedCount}</b> 已上柜</span>
        </div>
        <UserBar />
      </header>

      <nav className="mainnav">
        {NAV.map((n) => (
          <button
            key={n.to}
            className={cls("nav-item", activeNav === n.to && "active")}
            onClick={() => navigate(n.to)}
          >
            <span>{n.icon} {n.label}</span>
            {counts[n.to] !== undefined && (
              <em className={cls("nav-count", counts[n.to] === 0 && "zero")}>{counts[n.to]}</em>
            )}
          </button>
        ))}
        <span className="nav-spacer" />
        <button className="nav-ghost" onClick={loadSeed}>载入演示数据</button>
        <button className="nav-ghost danger" onClick={() => setConfirmClear(true)}>清空数据</button>
      </nav>

      <main className="content">{view}</main>

      <footer className="footer">
        数据保存在本浏览器 localStorage，队列 / 鉴定 / 地点卡 / 柜位 / 详情页共读同一份数据，重开页面可继续处理。
      </footer>

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={cls("toast", t.kind)}>{t.text}</div>
        ))}
      </div>

      {confirmClear && (
        <div className="modal-mask" onMouseDown={() => setConfirmClear(false)}>
          <div className="modal confirm" onMouseDown={(e) => e.stopPropagation()}>
            <h3>清空全部本地数据？</h3>
            <p className="muted">将删除所有标本、照片与柜位记录，且无法恢复。</p>
            <div className="modal-actions">
              <button className="primary danger" onClick={doClear}>确认清空</button>
              <button className="ghost" onClick={() => setConfirmClear(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <Shell />
    </RouterProvider>
  );
}
