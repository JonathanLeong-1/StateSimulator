/**
 * DefaultMapGenerator — Temporary developer utility for round-trip authoring.
 *
 * Allows developers to:
 * - Generate all 10 default maps locally
 * - Download each as a JSON file for editing
 * - Re-import edited versions back into the app
 *
 * This is a temporary workflow aid for the authoring phase. In production,
 * default maps are pre-generated and bundled.
 *
 * Hidden behind ?dev=1 URL parameter or VITE_DEV_MAPS=1 env var.
 */

import { useRef, useState, useEffect } from 'react';
import { loadGeoDatasetBrowser } from '../../geo/GeoDataset.browser';
import { rasterizeRegion } from '../../geo/rasterizeRegion';
import { DEFAULT_MAPS } from '../../geo/defaultMaps';
import type { GeoDataset } from '../../geo/GeoDataset';
import styles from './DefaultMapGenerator.module.css';

type MapStatus = 'pending' | 'generating' | 'complete' | 'error';

interface MapProgress {
  id: string;
  name: string;
  status: MapStatus;
  error?: string;
}

/**
 * Download helper — triggers a browser download of JSON file.
 */
function downloadJSON(filename: string, data: object): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DefaultMapGenerator() {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<MapProgress[]>([]);
  const [geodataLoaded, setGeodataLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const geodataRef = useRef<GeoDataset | null>(null);

  // Load geodata on mount
  useEffect(() => {
    const loadGeodata = async () => {
      try {
        const dataset = await loadGeoDatasetBrowser();
        geodataRef.current = dataset;
        setGeodataLoaded(true);
      } catch (e) {
        setError(`Failed to load geodata: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    loadGeodata();
  }, []);

  const handleGenerateAll = async () => {
    if (!geodataRef.current) {
      setError('Geodata not loaded');
      return;
    }

    setGenerating(true);
    setError(null);

    // Initialize progress map
    const initialProgress: MapProgress[] = DEFAULT_MAPS.map((map) => ({
      id: map.id,
      name: map.name,
      status: 'pending' as MapStatus,
    }));
    setProgress(initialProgress);

    for (let i = 0; i < DEFAULT_MAPS.length; i++) {
      const map = DEFAULT_MAPS[i];
      // Update to generating
      setProgress(prev => {
        const next = [...prev];
        next[i] = { ...next[i], status: 'generating' as MapStatus };
        return next;
      });

      try {
        const generated = await rasterizeRegion(map.bbox, geodataRef.current, {
          name: map.name,
          hexBudget: map.hexBudget ?? 40_000,
        });

        // Download
        downloadJSON(`${map.id}.worldmap.json`, generated);

        // Mark complete
        setProgress(prev => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'complete' as MapStatus };
          return next;
        });
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        setProgress(prev => {
          const next = [...prev];
          next[i] = {
            ...next[i],
            status: 'error' as MapStatus,
            error: errorMsg,
          };
          return next;
        });
      }
    }

    setGenerating(false);
  };

  if (!geodataLoaded) {
    return (
      <div className={styles.container}>
        <h3>🔧 Dev: Default Map Generator</h3>
        <p className={styles.loadingText}>{error || 'Loading geodata...'}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3>🔧 Dev: Default Map Generator</h3>
      <p className={styles.description}>
        Generate and download all default maps for local editing and re-import.
        This is a temporary authoring workflow tool.
      </p>

      <button
        className={styles.generateAllBtn}
        onClick={handleGenerateAll}
        disabled={generating}
      >
        {generating ? '⏳ Generating All Maps...' : '🚀 Generate & Download All'}
      </button>

      {error && <div className={styles.error}>{error}</div>}

      {progress.length > 0 && (
        <div className={styles.progressList}>
          {progress.map(item => (
            <div key={item.id} className={styles.progressItem}>
              <span className={styles.mapName}>{item.name}</span>
              <span className={`${styles.status} ${styles[`status_${item.status}`]}`}>
                {item.status === 'pending' && '⏳'}
                {item.status === 'generating' && '🔄'}
                {item.status === 'complete' && '✅'}
                {item.status === 'error' && '❌'}
                {' '}
                {item.status}
              </span>
              {item.error && <span className={styles.errorMsg}>{item.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
