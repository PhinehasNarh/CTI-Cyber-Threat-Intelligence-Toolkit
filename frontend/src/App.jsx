import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import NewsFeed from "./pages/NewsFeed";
import IOCExplorer from "./pages/IOCExplorer";
import Watchlist from "./pages/Watchlist";
import ATTACKHeatmap from "./pages/ATTACKHeatmap";
import ThreatTimeline from "./pages/ThreatTimeline";
import AlertRules from "./pages/AlertRules";
import ThreatActors from "./pages/ThreatActors";
import Campaigns from "./pages/Campaigns";
import AuditLog from "./pages/AuditLog";
import TriageQueue from "./pages/TriageQueue";
import Digest from "./pages/Digest";
import CorrelationGraph from "./pages/CorrelationGraph";
import Reader from "./pages/Reader";
import Leaderboard from "./pages/Leaderboard";
import WantedPoster from "./pages/WantedPoster";
import TimeLapse from "./pages/TimeLapse";
import Retention from "./pages/Retention";
import Workbench from "./pages/Workbench";
import CustomDashboard from "./pages/CustomDashboard";
import Clusters from "./pages/Clusters";
import Chatbot from "./pages/Chatbot";
import CTLogs from "./pages/CTLogs";
import WorldMap from "./pages/WorldMap";
import Honeypot from "./pages/Honeypot";
import Workspaces from "./pages/Workspaces";
import Integrations from "./pages/Integrations";
import ApiKeys from "./pages/ApiKeys";
import FeedScheduler from "./pages/FeedScheduler";

export default function App() {
  return (
    <Routes>
      {/* Standalone full-page route (no sidebar) for clean printing */}
      <Route path="/poster/:id" element={<WantedPoster />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/feed" element={<NewsFeed />} />
        <Route path="/read/:id" element={<Reader />} />
        <Route path="/clusters" element={<Clusters />} />
        <Route path="/assistant" element={<Chatbot />} />
        <Route path="/ctlogs" element={<CTLogs />} />
        <Route path="/map" element={<WorldMap />} />
        <Route path="/honeypot" element={<Honeypot />} />
        <Route path="/workspaces" element={<Workspaces />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/api-keys" element={<ApiKeys />} />
        <Route path="/scheduler" element={<FeedScheduler />} />
        <Route path="/iocs" element={<IOCExplorer />} />
        <Route path="/graph" element={<CorrelationGraph />} />
        <Route path="/actors" element={<ThreatActors />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/triage" element={<TriageQueue />} />
        <Route path="/workbench" element={<Workbench />} />
        <Route path="/my-dashboard" element={<CustomDashboard />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/alerts" element={<AlertRules />} />
        <Route path="/attack" element={<ATTACKHeatmap />} />
        <Route path="/timeline" element={<ThreatTimeline />} />
        <Route path="/timelapse" element={<TimeLapse />} />
        <Route path="/digest" element={<Digest />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/retention" element={<Retention />} />
      </Route>
    </Routes>
  );
}
