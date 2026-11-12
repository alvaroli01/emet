/** Indoors the first GPS fix is often 50 m+ off (2026-11-12): watch for up to `ms` and resolve with the most accurate
 *  reading (early at ±20 m). Rejects with the GeolocationPositionError if no reading came at all. Browser only. */
export function bestPosition(ms = 8000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    let best: GeolocationPosition | null = null;
    let over = false;
    const done = (err?: GeolocationPositionError) => {
      if (over) return;
      over = true; navigator.geolocation.clearWatch(id); clearTimeout(timer);
      if (best) resolve(best); else reject(err ?? new Error("no location"));
    };
    const timer = setTimeout(() => done(), ms);
    const id = navigator.geolocation.watchPosition((pos) => {
      if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
      if (pos.coords.accuracy <= 20) done();
    }, (e) => { if (!best) done(e); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
}
