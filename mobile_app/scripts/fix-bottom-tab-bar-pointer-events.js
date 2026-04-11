/**
 * react-native-web deprecates `pointerEvents` as a View prop; use style.pointerEvents.
 * @react-navigation/bottom-tabs@7.15.9 still sets the prop on Animated.View / View.
 * This postinstall fix removes the console warning on web. Safe no-op if upstream fixes it.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '../node_modules/@react-navigation/bottom-tabs/lib/module/views/BottomTabBar.js'
);

try {
  let s = fs.readFileSync(target, 'utf8');
  const a =
    "    }], tabBarStyle],\n    pointerEvents: isTabBarHidden ? 'none' : 'auto',\n    onLayout:";
  const b =
    "    }], tabBarStyle, {\n      pointerEvents: isTabBarHidden ? 'none' : 'auto'\n    }],\n    onLayout:";
  const c =
    '    children: [/*#__PURE__*/_jsx(View, {\n      pointerEvents: "none",\n      style: StyleSheet.absoluteFill,';
  const d =
    "    children: [/*#__PURE__*/_jsx(View, {\n      style: [StyleSheet.absoluteFill, {\n        pointerEvents: 'none'\n      }],";

  if (s.includes(a) && s.includes(c)) {
    s = s.replace(a, b).replace(c, d);
    fs.writeFileSync(target, s);
    console.log('[postinstall] Applied @react-navigation/bottom-tabs pointerEvents web fix.');
  } else if (s.includes(b) && s.includes("pointerEvents: 'none'\n      }],")) {
    console.log('[postinstall] bottom-tabs pointerEvents fix already present.');
  } else {
    console.warn('[postinstall] bottom-tabs BottomTabBar.js pattern changed; skip pointerEvents fix.');
  }
} catch (e) {
  console.warn('[postinstall] bottom-tabs pointerEvents fix skipped:', e.message);
}
