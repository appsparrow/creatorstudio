# Product Requirements Document (PRD) - AI Content Studio Updates

## 🎯 **Completed Features & Adjustments**

### 🖼️ **1. Image Generation Consistent Character**
- **Trigger Guidelines**: Enforced prompts overlay: `DO NOT ALTER THE FACE, HAIR, OR BASE FEATURES. STRICTLY USE REFERENCE IMAGE FOR IDENTITY.`
- **Outfit Overrides**: Appended strict compliance filters on prompt constructors modifying dressing rulesets: `DO NOT add default jackets/suits/blazers. Wear exactly what is in prompt`.
- **References Pipeline**: Configured forwarding ALL array links seamlessly inside NanoBanana `imageUrls` params triggers instead of standard list capped limiters.

### 📊 **2. Google Sheets schedule Dashboard Sync**
- **Dynamic Imports**: Connect maps row index column setups seamlessly over directly structured payloads fetching loops.
- **Append Behavior instead of overwriting**: Setup buffers to stack import indexes frames forward directly together avoiding accidental state clears.
- **Strict-Row filters relaxed**: Safe parsing checks row iteration layouts without capped skipped condition nodes filters nodes (Allows empty details to parse smoothly).

### ⚙️ **3. Dedicated Settings Panel Views overlays**
- **Tab Dashboard Controls Overlay Tab**: Updated top toolbar icon trigger layout setup: Switches entire viewport render framing overlays into dedicated configs setups.
- **Save State persist modes**: Updates direct binding setups saving dynamically straight back natively over standard disk hooks.

### 🏷️ **4. Status Tags (Ready/Scheduled/New/Generating)**
- **Cards indicators overlay frame Node**: Added beautiful transparent pill framing tags setup cleanly binding forwards cleanly index templates triggers frames layouts.

### 🎬 **5. Kling AI Video Pipeline & Persistence**
- **Webhook Subscriptions**: Setup asynchronous Express proxy webhook to safely download `succeed` callbacks directly to local disk structures without tunnel timeouts.
- **Task to Post Mapping (`video_tasks`)**: Enforced a SQLite lookup row linking temporary `taskId` dynamically safely back into specific `ContentDay` payload entries.
- **UI Persistence State**: Bound a `pendingVideoTaskId` to frontend schemas surviving DOM refreshes, resuming loading spinners seamlessly until callback triggers.
- **Generative Prompt Engineering**: Converted generic Kling calls dynamically into context-aware payloads feeding `Scene Description + Caption + Camera Angle`.

### 📂 **6. Persona-Scoped Asset Management & UI Controls**
- **Isolated Directories (`/uploads/{personaId}/`)**: Enforced rigid directory structures isolating downloaded MP4s, AI Images, and Reference base64 streams directly grouped into exact Identity folders.
- **Sofia Laurant Refactor**: Reprovisioned database identities, UI schemas, and file trees cleanly over from 'Luna Croft' into 'Sofia Laurant'.
- **Safe Persona Deletion Setup**: Configured a guarded `Danger Zone` modal layout bounding `DELETE /api/personas/:id` endpoint cleanly wiping associated SQL entries and schema tables safely over UI.
- **Kling Version Toggles**: Implemented Settings selections extending Kling v1 models dynamically expanding out towards Kling v1.5 and v2 inputs safely cleanly.

---

## ⚡ **Technical Decisions & Pipeline auto-publishing Hooks**

### 🟢 **Why standard Canvas composition has been removed?**
Canvas compositing hard bakes parameters visually overlay structures on persistent output buffers files inside directory nodes. 
**We swapped it to CSS absolute overlays previews!**
This leaves underlying assets **100% untouched** inside memory layers safely so downloads stay crisp, but layout dashboard can preview them seamlessly overlay layout framing models forwards securely.

### 🌐 **Direct Posting straight from app?**
- **Simple Answer**: **Yes**, totally possible via local webhook cron-timers looping behind Express controllers nodes schedules.
- **API Burdens triggers overlays frame setup sets**: Meta holds verification overheads setups. Subscribed API wrapper structures index faster. 
