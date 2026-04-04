import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Home from "./pages/Home";
import About from "./pages/About";
import Projects from "./pages/Projects";
import Contact from "./pages/Contact";
import AdminIngest from "./pages/AdminIngest";
import AdminWorkspace from "./pages/AdminWorkspace";
import HeroBg from "./components/HeroBg";
import Navbar from "./components/Navbar";
import PageTransition from "./components/PageTransition";
import SpotlightButton from "./components/SpotlightButton";
import { ChatProvider } from "./context/ChatContext";
import { CONFIG } from "./config";

/**
 * BlurOverlay — fixed background-image layer that blurs in on interior pages.
 * Uses the actual image + CSS filter (not backdrop-filter) to avoid tint artifacts.
 * Lives outside all motion.div transforms so position:fixed is truly viewport-fixed.
 */
function BlurOverlay() {
  const location = useLocation();
  const isInterior = location.pathname !== "/";
  return (
    <AnimatePresence>
      {isInterior && (
        <motion.div
          key="blur-overlay"
          className="blur-overlay"
          style={{ backgroundImage: `url(${CONFIG.backgroundImage})` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
        />
      )}
    </AnimatePresence>
  );
}

/**
 * AnimatedRoutes — must live inside BrowserRouter so useLocation works.
 * AnimatePresence plays exit animation before the next route mounts.
 */
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageTransition key={location.pathname}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/admin/ingest" element={<AdminIngest />} />
          <Route path="/admin/workspace" element={<AdminWorkspace />} />
        </Routes>
      </PageTransition>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    /*
      ChatProvider wraps the entire app so chat message state is shared across
      all routes.  Messages persist in sessionStorage (survives navigation,
      clears on refresh) and are readable by both Home.tsx and SpotlightButton.
    */
    <ChatProvider>
      <BrowserRouter>
        {/*
          HeroBg, BlurOverlay, Navbar, and SpotlightButton all live outside every
          animated container.
          - position:fixed inside a CSS transform context clips to that element,
            not the viewport — causing flicker and broken navbar on scroll.
          - Navbar is position:fixed here so it stays at top on tall interior pages.
          - BlurOverlay uses a real background-image (not backdrop-filter) — no tint.
          - SpotlightButton is position:fixed at bottom-left — visible on all pages.
        */}
        <HeroBg />
        <BlurOverlay />
        <Navbar />
        <SpotlightButton />
        <AnimatedRoutes />
      </BrowserRouter>
    </ChatProvider>
  );
}
