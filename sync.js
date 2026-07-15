window.GL = window.GL || {};

GL.sync = (function () {
  const { getState } = GL.store;

  // Data model (unchanged from the previous version, so existing users' data
  // keeps working with no migration of the security rules):
  //   users/{uid}                     -> profile doc {schemaVersion,goalTarget,theme,updatedAt}
  //   users/{uid}/dailyLogs/{date}    -> one doc per day
  //   users/{uid}/notes/{id}          -> journal entries
  //   users/{uid}/workouts/{date}     -> one plan doc per day

  let onSyncStatus = () => {};
  let onSyncError = () => {};
  let onData = () => {};

  function configureSync({ onStatus, onError, onDataChange }) {
    onSyncStatus = onStatus || onSyncStatus;
    onSyncError = onError || onSyncError;
    onData = onDataChange || onData;
  }

  function initSync(user) {
    const state = getState();
    state.cloud.unsubs.forEach((unsub) => unsub());
    state.cloud.unsubs = [];
    const db = firebase.firestore();
    try { db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch {}

    state.cloud.profileRef = db.collection("users").doc(user.uid);
    state.cloud.logsRef = state.cloud.profileRef.collection("dailyLogs");
    state.cloud.notesRef = state.cloud.profileRef.collection("notes");
    state.cloud.plansRef = state.cloud.profileRef.collection("workouts");
    onSyncStatus("Connecting\u2026");

    state.cloud.unsubs.push(
      state.cloud.profileRef.onSnapshot({ includeMetadataChanges: true }, (snapshot) => {
        if (snapshot.exists) {
          mergeProfile(snapshot.data());
          migrateLegacyData(snapshot.data());
        } else {
          saveProfile();
        }
        state.cloud.ready = true;
        onSyncStatus(snapshot.metadata.fromCache ? "Syncing\u2026" : "Synced");
      }, handleError)
    );

    listenCollection(state.cloud.logsRef, "logs", (docs) => docs.sort((a, b) => a.date.localeCompare(b.date)));
    listenCollection(state.cloud.notesRef, "journal", (docs) => docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    listenCollection(state.cloud.plansRef, "plans", (docs) => Object.fromEntries(docs.filter((d) => d.date).map((d) => [d.date, normalizePlan(d)])));
  }

  function normalizePlan(doc) {
    return { title: "", focus: "", notes: "", exercises: [], ...doc };
  }

  function listenCollection(ref, stateKey, transform) {
    const state = getState();
    state.cloud.unsubs.push(
      ref.onSnapshot({ includeMetadataChanges: true }, (snapshot) => {
        state[stateKey] = transform(snapshot.docs.map((doc) => doc.data()));
        onData();
        onSyncStatus(snapshot.metadata.fromCache ? "Syncing\u2026" : "Synced");
      }, handleError)
    );
  }

  function handleError(error) {
    console.error(error);
    onSyncStatus("Sync issue");
    onSyncError();
  }

  function mergeProfile(data) {
    const state = getState();
    state.goalTarget = Number(data.goalTarget) || 12;
    if (["light", "dark", "system"].includes(data.theme) && !localStorage.getItem("gym-log-theme")) {
      state.theme = data.theme;
    }
    if (Number(data.schemaVersion || 0) < 2) {
      state.logs = Array.isArray(data.logs) ? data.logs : state.logs;
      state.journal = Array.isArray(data.journal) ? data.journal : state.journal;
      state.plans = data.plans && typeof data.plans === "object" ? data.plans : state.plans;
    }
    onData();
  }

  async function migrateLegacyData(data) {
    const state = getState();
    if (state.cloud.migrating || Number(data.schemaVersion || 0) >= 2) return;
    state.cloud.migrating = true;
    try {
      const logs = Array.isArray(data.logs) ? data.logs : [];
      const notes = Array.isArray(data.journal) ? data.journal : [];
      const plans = data.plans && typeof data.plans === "object" ? Object.entries(data.plans) : [];
      await writeInChunks(logs.filter((item) => item?.date).map((item) => () => state.cloud.logsRef.doc(item.date).set(item, { merge: true })));
      await writeInChunks(notes.map((item, index) => () => state.cloud.notesRef.doc(item.id || `legacy-${item.createdAt || index}`).set({ ...item, id: item.id || `legacy-${item.createdAt || index}` }, { merge: true })));
      await writeInChunks(plans.map(([date, plan]) => () => state.cloud.plansRef.doc(date).set({ ...plan, date }, { merge: true })));
      await state.cloud.profileRef.set({ schemaVersion: 2, migratedAt: Date.now(), goalTarget: Number(data.goalTarget) || state.goalTarget, theme: data.theme || state.theme }, { merge: true });
    } catch (error) {
      handleError(error);
    } finally {
      state.cloud.migrating = false;
    }
  }

  async function writeInChunks(writes) {
    for (let i = 0; i < writes.length; i += 100) await Promise.all(writes.slice(i, i + 100).map((write) => write()));
  }

  function queueProfileSync() {
    const state = getState();
    if (state.auth.isGuest || !state.cloud.profileRef) return;
    clearTimeout(state.cloud.timer);
    state.cloud.timer = setTimeout(saveProfile, 450);
  }

  function saveProfile() {
    const state = getState();
    if (!state.cloud.profileRef || state.auth.isGuest) return;
    onSyncStatus("Syncing\u2026");
    state.cloud.profileRef.set({ schemaVersion: 2, goalTarget: state.goalTarget, theme: state.theme, updatedAt: Date.now() }, { merge: true })
      .then(() => onSyncStatus("Synced")).catch(handleError);
  }

  function saveLog(entry) {
    const state = getState();
    if (!state.cloud.logsRef) return;
    onSyncStatus("Syncing\u2026");
    state.cloud.logsRef.doc(entry.date).set(entry, { merge: true }).then(() => onSyncStatus("Synced")).catch(handleError);
  }

  function saveNote(note) {
    const state = getState();
    if (!state.cloud.notesRef) return;
    onSyncStatus("Syncing\u2026");
    state.cloud.notesRef.doc(note.id).set(note, { merge: true }).then(() => onSyncStatus("Synced")).catch(handleError);
  }

  function deleteNoteRemote(id) {
    const state = getState();
    if (state.cloud.notesRef) state.cloud.notesRef.doc(id).delete().catch(handleError);
  }

  function savePlanRecord(date, plan) {
    const state = getState();
    if (!state.cloud.plansRef || !plan) return;
    onSyncStatus("Syncing\u2026");
    state.cloud.plansRef.doc(date).set({ ...plan, date, updatedAt: Date.now() }, { merge: true }).then(() => onSyncStatus("Synced")).catch(handleError);
  }

  return { configureSync, initSync, queueProfileSync, saveProfile, saveLog, saveNote, deleteNoteRemote, savePlanRecord };
})();
