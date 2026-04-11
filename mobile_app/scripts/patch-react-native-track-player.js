/**
 * react-native-track-player: patches for RN 0.81 + New Architecture.
 *
 * 1) MusicModule.kt: Arguments.fromBundle expects non-null Bundle, but
 *    Track.originalItem is Bundle? — use safe let.
 * 2) @ReactMethod methods must return void (Unit). Using `fun x() = scope.launch { }`
 *    returns Job and breaks TurboModuleInterop ("returnType == void iff synchronous").
 *    Wrap as `fun x() { scope.launch { ... } }` and re-indent the coroutine body.
 *
 * Re-apply after every `npm install`.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-track-player',
  'android',
  'src',
  'main',
  'java',
  'com',
  'doublesymmetry',
  'trackplayer',
  'module',
  'MusicModule.kt'
);

if (!fs.existsSync(file)) {
  console.warn('[patch-rntp] MusicModule.kt missing, skip');
  process.exit(0);
}

let s = fs.readFileSync(file, 'utf8');

/** @returns {string} */
function patchBundleNullable(kt) {
  if (kt.includes('val item = musicService.tracks[index].originalItem')) {
    return kt;
  }

  const a = `        if (index >= 0 && index < musicService.tracks.size) {
            callback.resolve(Arguments.fromBundle(musicService.tracks[index].originalItem))
        } else {
            callback.resolve(null)
        }`;

  const b = `        if (index >= 0 && index < musicService.tracks.size) {
            val item = musicService.tracks[index].originalItem
            callback.resolve(item?.let { Arguments.fromBundle(it) })
        } else {
            callback.resolve(null)
        }`;

  if (!kt.includes(a)) {
    console.warn('[patch-rntp] getTrack block not found; RNTP version may have changed');
    return kt;
  }

  kt = kt.replace(a, b);

  const c = `        callback.resolve(
            if (musicService.tracks.isEmpty()) null
            else Arguments.fromBundle(
                musicService.tracks[musicService.getCurrentTrackIndex()].originalItem
            )
        )`;

  const d = `        callback.resolve(
            if (musicService.tracks.isEmpty()) null
            else {
                val item = musicService.tracks[musicService.getCurrentTrackIndex()].originalItem
                item?.let { Arguments.fromBundle(it) }
            }
        )`;

  if (!kt.includes(c)) {
    console.warn('[patch-rntp] getActiveTrack block not found; RNTP version may have changed');
    return kt;
  }

  return kt.replace(c, d);
}

/**
 * Wrap `= scope.launch { }` so @ReactMethod returns Unit, and indent the coroutine body +1 level.
 * @returns {string}
 */
function patchScopeLaunchUnitReturn(kt) {
  if (
    kt.includes(
      'fun updateOptions(data: ReadableMap?, callback: Promise) {\n        scope.launch {\n            if (verifyServiceBoundOrReject'
    )
  ) {
    return kt;
  }

  // Stock RNTP splits this method across two lines and uses 12-space body indent; normalize
  // to the same shape as other @ReactMethod + scope.launch blocks (8-space body) before wrapping.
  const updateMetaOld = `    @ReactMethod
    fun updateMetadataForTrack(index: Int, map: ReadableMap?, callback: Promise) =
        scope.launch {
            if (verifyServiceBoundOrReject(callback)) return@launch

            if (index < 0 || index >= musicService.tracks.size) {
                callback.reject("index_out_of_bounds", "The index is out of bounds")
            } else {
                val context: ReactContext = context
                val track = musicService.tracks[index]
                track.setMetadata(context, Arguments.toBundle(map), musicService.ratingType)
                musicService.updateMetadataForTrack(index, track)

                callback.resolve(null)
            }
        }`;

  const updateMetaNew = `    @ReactMethod
    fun updateMetadataForTrack(index: Int, map: ReadableMap?, callback: Promise) = scope.launch {
        if (verifyServiceBoundOrReject(callback)) return@launch

        if (index < 0 || index >= musicService.tracks.size) {
            callback.reject("index_out_of_bounds", "The index is out of bounds")
        } else {
            val context: ReactContext = context
            val track = musicService.tracks[index]
            track.setMetadata(context, Arguments.toBundle(map), musicService.ratingType)
            musicService.updateMetadataForTrack(index, track)

            callback.resolve(null)
        }
    }`;

  if (kt.includes(updateMetaOld)) {
    kt = kt.replace(updateMetaOld, updateMetaNew);
  }

  kt = kt.replace(/\) = scope\.launch \{/g, ') {\n        scope.launch {');

  const lines = kt.split(/\r?\n/);
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const prev = out.length > 0 ? out[out.length - 1] : '';

    const isReactMethodStyleFun =
      /^\s+fun\s+\w+/.test(prev) &&
      !/override/.test(prev) &&
      /Promise/.test(prev) &&
      /^\s+fun\s+\w+/.test(line) === false;

    if (
      /^        scope\.launch \{/.test(line) &&
      isReactMethodStyleFun
    ) {
      out.push(line);
      i++;
      let depth = 1;
      while (i < lines.length && depth > 0) {
        const L = lines[i];
        const opens = (L.match(/\{/g) || []).length;
        const closes = (L.match(/\}/g) || []).length;
        // Indent every line inside scope.launch (including the closing `}`), which may be 4 spaces.
        out.push('    ' + L);
        depth += opens - closes;
        i++;
      }
      out.push('    }');
      continue;
    }

    out.push(line);
    i++;
  }

  return out.join('\n');
}

s = patchBundleNullable(s);
s = patchScopeLaunchUnitReturn(s);
fs.writeFileSync(file, s, 'utf8');
console.log('[patch-rntp] MusicModule.kt patched (Bundle?, New Arch @ReactMethod Unit)');
