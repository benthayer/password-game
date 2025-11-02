import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import MainPage from './MainPage';
import PasswordDisplay from './PasswordDisplay';
import GamePage from './GamePage';

export type PasswordSource = 'auto-generated' | 'manual';

function AppRouter() {
  const [password, setPassword] = useState<string>('');
  const [passwordSource, setPasswordSource] = useState<PasswordSource>('manual');

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<MainPage setPassword={setPassword} setPasswordSource={setPasswordSource} />}
        />
        <Route
          path="/display"
          element={<PasswordDisplay password={password} source={passwordSource} />}
        />
        <Route
          path="/game"
          element={<GamePage setPassword={setPassword} setPasswordSource={setPasswordSource} />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;

