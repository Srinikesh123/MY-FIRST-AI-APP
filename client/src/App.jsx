import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ChatProvider } from './contexts/ChatContext';
import { UserProvider } from './contexts/UserContext';
import { ToastProvider } from './components/ui/Toast';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage/LoginPage';
import ChatPage from './pages/ChatPage/ChatPage';
import SettingsPage from './pages/SettingsPage/SettingsPage';
import ChatsPage from './pages/ChatsPage/ChatsPage';
import MorePage from './pages/MorePage/MorePage';
import GamesPage from './pages/GamesPage/GamesPage';
import ShopPage from './pages/ShopPage/ShopPage';
import BookPage from './pages/BookPage/BookPage';
import MeetingPage from './pages/MeetingPage/MeetingPage';

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ToastProvider>
        <UserProvider>
          <ChatProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<ChatPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/chats" element={<ChatsPage />} />
                  <Route path="/more" element={<MorePage />} />
                  <Route path="/games" element={<GamesPage />} />
                  <Route path="/shop" element={<ShopPage />} />
                  <Route path="/book" element={<BookPage />} />
                  <Route path="/meeting" element={<MeetingPage />} />
                </Route>
              </Route>
            </Routes>
          </ChatProvider>
        </UserProvider>
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
