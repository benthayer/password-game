import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import MainPage from './MainPage';
import PasswordDisplay from './PasswordDisplay';
import GamePage from './GamePage';
import PracticePage from './PracticePage';

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
        <Route
          path="/practice"
          element={<PracticePage password={password} />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;

