import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import Settings from "./pages/Settings";
import Saved from "./pages/Saved";
import Messages from "./pages/Messages";
import Search from "./pages/Search";
import Notifications from "./pages/Notifications";
import Groups from "./pages/Groups";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:userId" element={<UserProfile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/saved" element={<Saved />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/search" element={<Search />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/groups" element={<Groups />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
