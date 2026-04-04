import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Search from './pages/Search';
import Saved from './pages/Saved';
import Compare from './pages/Compare';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Search />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/compare" element={<Compare />} />
      </Route>
    </Routes>
  );
}
