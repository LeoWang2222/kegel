# 凯格尔运动小助手 · 项目交接文档（PROJECT_HANDOFF）

> 用途：当对话上下文丢失 / 换 AI / 换设备时，凭本文档可完整接手本项目。
> 最后更新：2026-09（v1 上线时）

## 一、项目是什么

「凯格尔运动小助手」是一个**男性凯格尔（PC肌）训练**网页 APP（PWA），用户为 iPhone 17 单人自用。
核心玩法：**手指按住屏幕上的蜜桃 = 收紧PC肌，松开 = 放松**，一组 10 次，每天目标若干组（默认 3 组）。
本项目由「轻提纲」（提肛练习助手）复刻改造而来：交互、设计、代码结构完全沿用，仅替换名称、文案（面向男性提升性能力）、图标（💪）、存储键与 SW 缓存名。

## 二、关键地址与账号

| 项目 | 值 |
|---|---|
| 网站地址（手机访问） | https://leowang2222.github.io/kegel/ |
| GitHub 仓库（公开） | https://github.com/LeoWang2222/kegel |
| GitHub 账号 | LeoWang2222（gh CLI 已登录） |
| 本地文件夹 | `C:\Users\24509\Desktop\凯格尔运动小助手`（git main 分支，remote 已配好） |
| git 提交身份 | `LeoWang2222` / `LeoWang2222@users.noreply.github.com`（用 `git -c user.name=... -c user.email=...` 提交） |

## 三、文件清单

| 文件 | 作用 |
|---|---|
| `index.html` | **整个 APP 本体**：HTML+CSS+JS 全部内嵌，单文件 |
| `sw.js` | Service Worker 离线缓存。**每次改代码必须升级里面的 `CACHE` 版本号**（当前 `kegel-v1`），否则手机不更新 |
| `manifest.webmanifest` | PWA 配置（standalone、图标、主题色 #edf5f0） |
| `apple-touch-icon.png` (180×180) | iOS 主屏幕图标（PIL + Segoe UI Emoji 生成的 💪 图） |
| `icon-512.png` (512×512) | manifest 图标 |

## 四、功能现状（v1）

与「轻提纲」v3 完全一致：首页（今日状态/训练入口/当前计划/提醒倒计时）、练习页（按住收紧 `holdSec` 秒 × 10 次 = 1 组，提前松手作废，庆祝动效）、打卡页（月历自动打勾、连续/累计统计）、我的（目标组数 1~10、收紧秒数 2~10、清空数据）。
文案差异：定位男性 PC 肌训练（提升硬度与持久力），鼓励语男性化，吉祥物仍是蜜桃 SVG，图标为 💪。

## 五、技术要点与坑（继承自原项目，同样适用）

1. **数据存储**：localStorage，键 `kegel_helper_v1`（全新，无迁移逻辑）。日期格式 `年-月-日`（不补零），勿改。
2. **iOS 无 Vibration API**：震动用 `<input type="checkbox" switch>` + label.click() 的 iOS 17.4+ 触觉 hack（`haptic()`），WebAudio `beep()` 兜底。
3. **iOS 网页无法后台推送**：提醒只是页面内倒计时，别承诺系统级通知。
4. **iOS 主屏幕图标必须真实 PNG**（不支持 SVG/data URI）。重绘图标：用 PIL + `C:\Windows\Fonts\seguiemj.ttf`，`draw.text(..., embedded_color=True)`。
5. **进度环**：SVG circle r=120，周长 754，改半径要同步改。
6. **按压交互**：Pointer Events，`touch-action:none` + 阻止 contextmenu。
7. **部署流程**：
   ```bash
   cd "/c/Users/24509/Desktop/凯格尔运动小助手"
   # 1. sw.js 里 CACHE 版本号 +1
   # 2. 抽出 <script> 用 node --check 验证
   git add -A && git -c user.name="LeoWang2222" -c user.email="LeoWang2222@users.noreply.github.com" commit -m "说明" && git push
   # 3. curl https://leowang2222.github.io/kegel/index.html 验证（Pages 构建约 30~60 秒）
   ```
8. **GitHub Pages 免费版要求公开仓库**：数据在手机本地，仓库无隐私内容。

## 六、环境备忘（本机）

- Windows + Git Bash；Python 3.14 在 `D:\python`（有 PIL）；Node v24 在 `D:\NODE`；gh CLI 在 `C:\Program Files\GitHub CLI`
- iOS 添加到主屏幕：Safari 打开 https://leowang2222.github.io/kegel/ → 分享 → 添加到主屏幕

## 七、用户偏好

- 中文交流；砍功能求简洁、求手感，不要功能堆砌；只做凯格尔训练，勿加无关功能
