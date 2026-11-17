import { Suspense, useEffect } from 'react';
import { Experience } from './scene/Experience.jsx';
import { Intro, TopBar, IndexNav, FocusPanel, HoverCard, CountryPanel, Cursor, Keys, Detail, ListView } from './ui/Overlay.jsx';
import { initialFromHash } from './store.js';

export default function App() {
  useEffect(initialFromHash, []);
  return (
    <>
      <div className="stage">
        <Suspense fallback={null}>
          <Experience />
        </Suspense>
      </div>
      <TopBar />
      <FocusPanel />
      <HoverCard />
      <CountryPanel />
      <IndexNav />
      <ListView />
      <Detail />
      <Cursor />
      <Keys />
      <Intro />
    </>
  );
}
