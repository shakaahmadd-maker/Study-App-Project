/* global apiClient */

// Meeting Room client:
// - Loads meeting metadata from backend
// - Connects to Channels WebSocket for signaling + realtime events
// - Establishes 1:1 WebRTC (student <-> teacher)
// - Syncs chat, whiteboard, reactions over WebSocket
// - Records (teacher/host) locally and uploads MP4 to backend after meeting end

(function () {
  const qs = new URLSearchParams(window.location.search);
  const meetingId = qs.get("meeting_id");
  if (!meetingId) {
    alert("Missing meeting_id");
    return;
  }

  const userId = (localStorage.getItem("user_id") || "").toString();
  const userRole = (localStorage.getItem("user_role") || "").toString();
  const userName = (localStorage.getItem("user_name") || "").toString() || "You";

  // Elements
  const centerStatus = document.getElementById("centerStatus");
  const recordIndicator = document.getElementById("recordIndicator");
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");
  const timerEl = document.getElementById("timer");
  const teacherJoinModal = document.getElementById("teacherJoinModal");
  const teacherStartBtn = document.getElementById("teacherStartBtn");

  const muteBtn = document.getElementById("muteBtn");
  const videoBtn = document.getElementById("videoBtn");
  const shareBtn = document.getElementById("shareBtn");
  const whiteboardBtn = document.getElementById("whiteboardBtn");
  const recordBtn = document.getElementById("recordBtn");
  const chatBtn = document.getElementById("chatBtn");
  const reactionsBtn = document.getElementById("reactionsBtn");
  const endMeetingBtn = document.getElementById("endMeetingBtn");
  const leaveBtn = document.getElementById("leaveBtn");
  const fileBtn = document.getElementById("fileBtn");
  const fileInput = document.getElementById("fileInput");
  const chatFileList = document.getElementById("chatFileList");

  const videoArea = document.getElementById("videoArea");
  const whiteboardArea = document.getElementById("whiteboardArea");

  const videoYou = document.getElementById("videoYou");
  const myVideoTile = document.getElementById("myVideoTile");

  // We'll reuse the first remote tile (Monica) as remote participant tile.
  const remoteTile = document.querySelector('.video-tile[data-participant="monica"]');
  const remoteVideo = document.getElementById("videoMonica");
  const videoAreaEl = document.getElementById("videoArea");
  const videoGridEl = document.querySelector(".video-grid");

  // Full-screen screen share stage (created in JS to avoid template churn)
  const screenStage = document.createElement("div");
  screenStage.id = "screenShareStage";
  screenStage.className = "screen-share-stage hidden";
  screenStage.innerHTML = `
    <video id="screenSharePreview" autoplay playsinline></video>
    <div class="screen-share-toolbar">
      <span class="screen-share-label"><i class="fas fa-desktop"></i> Screen sharing</span>
      <button class="screen-share-close" id="stopScreenShareInline" title="Stop sharing">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
  videoAreaEl?.appendChild(screenStage);
  const screenSharePreview = screenStage.querySelector("#screenSharePreview");
  const stopScreenShareInlineBtn = screenStage.querySelector("#stopScreenShareInline");

  // Local PiP video (shown during screen sharing)
  const pip = document.createElement("div");
  pip.className = "local-pip";
  pip.innerHTML = `<video id="pipVideo" autoplay playsinline muted></video>`;
  videoAreaEl?.appendChild(pip);
  const pipVideo = pip.querySelector("#pipVideo");

  let remoteScreenShareActive = false;
  let screenShareHeartbeat = null;

  async function safePlay(videoEl) {
    if (!videoEl) return;
    try {
      await videoEl.play();
    } catch (e) {
      // Autoplay policies can block; ignore (user gesture will unblock)
    }
  }

  function getInboundVideoTracks() {
    try {
      return pc?.getReceivers?.()
        .filter((r) => r.track && r.track.kind === "video")
        .map(r => r.track) || [];
    } catch (e) {
      return [];
    }
  }

  function getInboundVideoTrack(preferSecondary = false) {
    try {
      const tracks = getInboundVideoTracks();
      if (tracks.length === 0) return null;
      
      if (preferSecondary && tracks.length > 1) {
        // Assume the one that isn't the primary one is the secondary/screen
        const primaryTrack = remoteVideo?.srcObject?.getVideoTracks()[0];
        if (primaryTrack) {
          const secondary = tracks.find(t => t.id !== primaryTrack.id);
          if (secondary) return secondary;
        }
        return tracks[1];
      }
      return tracks[0];
    } catch (e) {
      return null;
    }
  }

  async function attachRemoteVideoToScreenStageWithRetry() {
    if (!screenSharePreview) return;
    console.log("[ScreenShare] Attaching remote video to screen stage...");
    
    // Clear previous srcObject to force a refresh
    screenSharePreview.srcObject = null;

    // Prefer secondary track (screen share) if available
    for (let i = 0; i < 15; i++) {
      const inboundTrack = getInboundVideoTrack(true);
      if (inboundTrack && inboundTrack.readyState === 'live') {
        console.log("[ScreenShare] Found live inbound track, attaching...");
        screenSharePreview.srcObject = new MediaStream([inboundTrack]);
        screenSharePreview.muted = true;
        await safePlay(screenSharePreview);
        return true;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    console.error("[ScreenShare] Failed to attach remote video after retries.");
    return false;
  }

  const participantCountEl = document.getElementById("participantCount");
  const inCallCountEl = document.getElementById("inCallCount");
  const participantsList = document.querySelector(".participants-list");

  const sidePanelTabs = document.querySelectorAll(".side-panel-tab");
  const participantsTab = document.getElementById("participantsTab");
  const chatTab = document.getElementById("chatTab");
  const sidePanel = document.querySelector(".side-panel");
  const chatMessages = document.getElementById("chatMessages");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");

  // Whiteboard
  const canvas = document.getElementById("whiteboardCanvas");
  const ctx = canvas.getContext("2d");
  const penTool = document.getElementById("penTool");
  const eraserTool = document.getElementById("eraserTool");
  const clearBoard = document.getElementById("clearBoard");
  const colorPicker = document.getElementById("colorPicker");
  const colorPreview = document.getElementById("colorPreview");

  // State
  let meeting = null;
  let ws = null;
  let pc = null;
  let localStream = null;
  let screenStream = null;
  let isScreenSharing = false;
  let otherUserId = null;
  let otherUserName = "Participant";
  let screenSender = null; // Track the RTCRtpSender for screen sharing

  function canShareScreen() {
    // Allow all participants in the meeting to share their screen
    return true;
  }

  function setShareButtonEnabled(enabled) {
    if (!shareBtn) return;
    shareBtn.disabled = !enabled;
    shareBtn.title = "Share your screen";
    shareBtn.style.opacity = "";
    shareBtn.style.cursor = "";
  }

  // Cross-tab updates (dashboard tab <-> meeting room tab)
  const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("meeting-status") : null;

  // Track media states for participants (for icon updates)
  const mediaStateByUser = {};

  function setMediaState(uid, partial) {
    if (!uid) return;
    if (!mediaStateByUser[uid]) mediaStateByUser[uid] = { audio: null, video: null };
    mediaStateByUser[uid] = { ...mediaStateByUser[uid], ...partial };
  }

  function renderRowIcons(row, audioEnabled, videoEnabled) {
    if (!row) return;
    const icons = row.querySelector(".participant-icons");
    if (!icons) return;
    const mic = icons.querySelector("i:nth-child(1)");
    const cam = icons.querySelector("i:nth-child(2)");
    if (mic) mic.className = audioEnabled === false ? "fas fa-microphone-slash" : "fas fa-microphone";
    if (cam) cam.className = videoEnabled === false ? "fas fa-video-slash" : "fas fa-video";
  }

  function updateRowStatusAndIcons(uid) {
    const isMe = String(uid) === String(userId);
    const row = isMe
      ? participantsList?.querySelector(".participant-row.me")
      : participantsList?.querySelector(`.participant-row[data-user-id="${uid}"]`);

    if (!row) return;
    const meta = row.querySelector(".participant-meta");
    const st = mediaStateByUser[uid] || {};

    // Fallbacks
    const aEnabled = st.audio !== null ? st.audio : (isMe ? !!localStream?.getAudioTracks?.()[0]?.enabled : true);
    const vEnabled = st.video !== null ? st.video : (isMe ? !!localStream?.getVideoTracks?.()[0]?.enabled : true);

    renderRowIcons(row, aEnabled, vEnabled);

    if (isMe && meta) {
      const roleLabel = userRole === "TEACHER" ? "Teacher" : "Student";
      const callLabel = ws && ws.readyState === WebSocket.OPEN ? "In call" : "Connecting…";
      meta.textContent = `${roleLabel} · ${callLabel} · Mic ${aEnabled ? "on" : "off"} · Video ${vEnabled ? "on" : "off"}`;
    }
  }

  // Recording
  let recorder = null;
  let recordingChunks = [];
  let isRecording = false;
  let recordingStream = null;

  async function startTabRecording() {
    if (isRecording) return;
    
    try {
      // getDisplayMedia is used to capture the full meeting room UI (chat, whiteboard, etc.)
      recordingStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
          selfBrowserSurface: "include",
          cursor: "always"
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        systemAudio: "include"
      });

      const videoTrack = recordingStream.getVideoTracks()[0];
      const mixedAudioStream = new MediaStream();
      if (videoTrack) mixedAudioStream.addTrack(videoTrack);

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();

      const displayAudioTracks = recordingStream.getAudioTracks();
      if (displayAudioTracks.length > 0) {
        const displaySrc = audioCtx.createMediaStreamSource(new MediaStream([displayAudioTracks[0]]));
        displaySrc.connect(dest);
      }

      if (localStream && localStream.getAudioTracks().length > 0) {
        const localMicSrc = audioCtx.createMediaStreamSource(new MediaStream([localStream.getAudioTracks()[0]]));
        localMicSrc.connect(dest);
      }

      if (remoteVideo && remoteVideo.srcObject && remoteVideo.srcObject.getAudioTracks().length > 0) {
        const remoteSrc = audioCtx.createMediaStreamSource(new MediaStream([remoteVideo.srcObject.getAudioTracks()[0]]));
        remoteSrc.connect(dest);
      }

      const mixedAudioTrack = dest.stream.getAudioTracks()[0];
      if (mixedAudioTrack) mixedAudioStream.addTrack(mixedAudioTrack);

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') 
        ? 'video/webm;codecs=vp9,opus' 
        : 'video/webm';
      
      recorder = new MediaRecorder(mixedAudioStream, { mimeType });
      recordingChunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordingChunks.push(e.data);
      };

      recorder.onstop = () => {
        isRecording = false;
        if (recordIndicator) recordIndicator.style.display = "none";
        if (recordBtn) {
          recordBtn.classList.remove("active");
          recordBtn.querySelector("span").textContent = "Record";
        }
        if (recordingStream) {
          recordingStream.getTracks().forEach(t => t.stop());
          recordingStream = null;
        }
      };

      recorder.start(1000);
      isRecording = true;
      if (recordIndicator) recordIndicator.style.display = "inline-flex";
      if (recordBtn) {
        recordBtn.classList.add("active");
        recordBtn.querySelector("span").textContent = "Stop";
      }

      videoTrack.onended = () => {
        if (isRecording) {
          recorder.stop();
          uploadRecording();
        }
      };

      setStatus("Recording started.");
      return true;
    } catch (e) {
      console.error("Failed to start recording:", e);
      setStatus("Recording permission denied or failed.");
      return false;
    }
  }

  async function uploadRecording() {
    if (!recordingChunks.length) return;
    setStatus("Uploading recording...");
    const blob = new Blob(recordingChunks, { type: recorder?.mimeType || "video/webm" });
    const file = new File([blob], `meeting-${meetingId}.webm`, { type: "video/webm" });
    const form = new FormData();
    form.append("recording", file);
    try {
      await apiClient.postFormData(`/meeting/api/${meetingId}/upload-recording/`, form);
      setStatus("Recording uploaded successfully.");
    } catch (e) {
      console.error("Upload failed:", e);
      setStatus("Failed to upload recording.");
    }
  }

  const iceServers = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

  function setStatus(msg) {
    if (centerStatus) centerStatus.textContent = msg;
  }

  function safeJsonSend(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  function protocol() {
    return window.location.protocol === "https:" ? "wss:" : "ws:";
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function updateParticipantCount() {
    const count = participantsList ? participantsList.querySelectorAll(".participant-row").length : 1;
    if (participantCountEl) participantCountEl.textContent = String(count);
    if (inCallCountEl) inCallCountEl.textContent = `${count} in call`;
  }

  function updateVideoLayout() {
    if (!videoGridEl) return;
    const remoteHidden = remoteTile?.classList.contains("hidden");
    videoGridEl.classList.toggle("solo", !!remoteHidden);
  }

  function updateMyRowStatus() {
    const myRow = participantsList?.querySelector(".participant-row.me");
    if (!myRow) return;
    const meta = myRow.querySelector(".participant-meta");
    if (!meta) return;
    const aEnabled = localStream ? !!localStream.getAudioTracks()[0]?.enabled : false;
    const vEnabled = localStream ? !!localStream.getVideoTracks()[0]?.enabled : false;
    const roleLabel = userRole === "TEACHER" ? "Teacher" : "Student";
    const callLabel = ws && ws.readyState === WebSocket.OPEN ? "In call" : "Connecting…";
    meta.textContent = `${roleLabel} · ${callLabel} · Mic ${aEnabled ? "on" : "off"} · Video ${vEnabled ? "on" : "off"}`;
    setMediaState(userId || "me", { audio: aEnabled, video: vEnabled });
    updateRowStatusAndIcons(userId || "me");
  }

  function clearMockParticipants() {
    // Remove extra sample tiles (seth, antwan). Keep "you" + "monica" as remote tile.
    document.querySelectorAll('.video-tile[data-participant="seth"], .video-tile[data-participant="antwan"]').forEach((el) => el.remove());
    // Remove sample participant rows except ".me"
    participantsList?.querySelectorAll(".participant-row:not(.me)")?.forEach((el) => el.remove());

    // Update my labels
    const myNameTag = myVideoTile?.querySelector(".name-tag span:nth-child(2)");
    if (myNameTag) myNameTag.textContent = userName;
    const myAvatar = myVideoTile?.querySelector(".avatar");
    if (myAvatar) myAvatar.textContent = userName[0] || "Y";
    const myRowName = participantsList?.querySelector(".participant-row.me .participant-name");
    if (myRowName) myRowName.textContent = userName;

    // Remote defaults
    const remoteAvatar = remoteTile?.querySelector(".avatar");
    if (remoteAvatar) remoteAvatar.textContent = otherUserName[0] || "P";
    const remoteNameTag = remoteTile?.querySelector(".name-tag span:nth-child(2)");
    if (remoteNameTag) remoteNameTag.textContent = otherUserName;

    updateParticipantCount();
    updateVideoLayout();
  }

  function initThemeToggle() {
    if (!themeToggle || !themeIcon) return;
    const html = document.documentElement;
    const savedTheme = localStorage.getItem("meetingTheme") || "dark";
    html.setAttribute("data-theme", savedTheme);
    themeIcon.className = savedTheme === "light" ? "fas fa-sun" : "fas fa-moon";
    themeToggle.addEventListener("click", () => {
      const current = html.getAttribute("data-theme") || "dark";
      const next = current === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", next);
      localStorage.setItem("meetingTheme", next);
      themeIcon.className = next === "light" ? "fas fa-sun" : "fas fa-moon";
    });
  }

  function startTimer(startAtMs) {
    if (!timerEl) return;
    const start = typeof startAtMs === "number" ? startAtMs : Date.now();
    const tick = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
      const s = String(elapsed % 60).padStart(2, "0");
      timerEl.textContent = `${m}:${s}`;
    };
    tick();
    setInterval(tick, 1000);
  }

  function addRemoteParticipantRow() {
    if (!participantsList) return;
    if (participantsList.querySelector(`.participant-row[data-user-id="${otherUserId}"]`)) return;
    const row = document.createElement("div");
    row.className = "participant-row";
    row.dataset.userId = otherUserId;
    row.innerHTML = `
      <div class="participant-avatar">${escapeHtml(otherUserName[0] || "P")}</div>
      <div class="participant-info">
        <div class="participant-name">${escapeHtml(otherUserName)}</div>
        <div class="participant-meta">Participant</div>
      </div>
      <div class="participant-icons">
        <i class="fas fa-microphone"></i>
        <i class="fas fa-video"></i>
      </div>
    `;
    participantsList.appendChild(row);
    updateParticipantCount();
    // default unknown state => treat as enabled until we hear otherwise
    if (otherUserId) {
      setMediaState(otherUserId, { audio: true, video: true });
      updateRowStatusAndIcons(otherUserId);
    }
  }

  function setRemoteLabels(name) {
    otherUserName = name || otherUserName;
    const remoteAvatar = remoteTile?.querySelector(".avatar");
    if (remoteAvatar) remoteAvatar.textContent = otherUserName[0] || "P";
    const remoteNameTag = remoteTile?.querySelector(".name-tag span:nth-child(2)");
    if (remoteNameTag) remoteNameTag.textContent = otherUserName;
    remoteTile?.classList.remove("hidden");
    addRemoteParticipantRow();
    updateVideoLayout();
  }

  async function loadMeeting() {
    meeting = await apiClient.getMeetingDetails(meetingId);
    const date = new Date(meeting.scheduled_at);
    document.querySelectorAll(".meeting-title").forEach((el) => (el.textContent = meeting.title));
    const subtitle = `${date.toLocaleDateString()} · ${date.toLocaleTimeString()} · Study Companion`;
    const subtitleEl = document.querySelector(".meeting-subtitle");
    if (subtitleEl) subtitleEl.textContent = subtitle;

    // Show/hide buttons based on role
    const isTeacher = userRole === "TEACHER" || String(meeting.host) === String(userId);
    if (isTeacher) {
      if (recordBtn) recordBtn.style.display = "flex";
      if (endMeetingBtn) endMeetingBtn.style.display = "flex";
      // Make Leave button distinct from End button for teachers
      if (leaveBtn) {
        leaveBtn.classList.remove("danger");
        leaveBtn.style.backgroundColor = "var(--bg-button)";
        leaveBtn.style.borderColor = "var(--accent-blue)";
        leaveBtn.style.color = "var(--text-secondary)";
      }
    }

    // Determine remote user
    if (meeting.student && meeting.teacher) {
      if (String(meeting.student) === String(userId)) {
        otherUserId = String(meeting.teacher);
        otherUserName = meeting.teacher_details?.full_name || "Teacher";
      } else {
        otherUserId = String(meeting.student);
        otherUserName = meeting.student_details?.full_name || "Student";
      }
      // Note: Do NOT call setRemoteLabels here. 
      // We only show the remote tile once they actually join (handled in WebSocket onmessage).
    }

    clearMockParticipants();
  }

  async function startMediaStream() {
    try {
      const savedState = JSON.parse(sessionStorage.getItem("mediaState") || "{}");
      const initialCamera = savedState.cameraEnabled !== false;
      const initialMic = savedState.microphoneEnabled !== false;

      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (e) {
        console.warn("Real media access failed, trying mock stream for testing...", e);
        // Create a mock stream for testing on same computer
        const mockCanvas = document.createElement("canvas");
        mockCanvas.width = 640;
        mockCanvas.height = 480;
        const mockCtx = mockCanvas.getContext("2d");
        
        // Draw something dynamic on the mock canvas
        function drawMock() {
          mockCtx.fillStyle = "#1e293b";
          mockCtx.fillRect(0, 0, 640, 480);
          mockCtx.fillStyle = "#3b82f6";
          mockCtx.font = "30px Inter";
          mockCtx.fillText(`Mock Camera (${userName})`, 50, 100);
          mockCtx.fillText(new Date().toLocaleTimeString(), 50, 150);
          requestAnimationFrame(drawMock);
        }
        drawMock();
        
        localStream = mockCanvas.captureStream(30);
        // Add a silent audio track
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        localStream.addTrack(dest.stream.getAudioTracks()[0] || new MediaStreamTrack());
        
        setStatus("Using mock camera/mic for testing.");
      }

      // Apply initial preferences
      const vTrack = localStream.getVideoTracks()[0];
      const aTrack = localStream.getAudioTracks()[0];
      if (vTrack) vTrack.enabled = !!initialCamera;
      if (aTrack) aTrack.enabled = !!initialMic;

      videoYou.srcObject = localStream;
      if (vTrack?.enabled) videoYou.classList.add("active");
      else videoYou.classList.remove("active");

      if (!localStream.getAudioTracks().length) {
        setStatus("Camera active (No microphone found).");
      } else {
        setStatus("Camera and microphone are active.");
      }
      
      syncLocalButtonState();
      updateMyRowStatus();

      // Ensure remote video is allowed to play audio
      try {
        remoteVideo.muted = false;
        remoteVideo.volume = 1;
      } catch (e) {
        // ignore
      }
    } catch (e) {
      console.error(e);
      setStatus("Unable to access camera/microphone. Please check permissions.");
      updateMyRowStatus();
    }
  }

  function syncLocalButtonState() {
    const muted = localStream ? !localStream.getAudioTracks()[0]?.enabled : false;
    const videoOff = localStream ? !localStream.getVideoTracks()[0]?.enabled : false;

    muteBtn.classList.toggle("active", muted);
    muteBtn.querySelector("i").className = muted ? "fas fa-microphone-slash" : "fas fa-microphone";
    muteBtn.querySelector("span").textContent = muted ? "Unmute" : "Mute";

    videoBtn.classList.toggle("active", videoOff);
    videoBtn.querySelector("i").className = videoOff ? "fas fa-video-slash" : "fas fa-video";
    videoBtn.querySelector("span").textContent = videoOff ? "Start Video" : "Stop Video";
  }

  function ensurePeerConnection() {
    if (pc) return pc;
    pc = new RTCPeerConnection(iceServers);

    // Local tracks
    if (localStream) {
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      safeJsonSend({
        type: "candidate",
        candidate: event.candidate,
        target_user_id: otherUserId,
      });
    };

    pc.ontrack = (event) => {
      console.log("[WebRTC] Received remote track:", event.track.kind, event.streams);
      const stream = event.streams[0];
      
      if (event.track.kind === "video") {
        // If we already have a primary remote video stream and this is a DIFFERENT stream object
        if (remoteVideo.srcObject && remoteVideo.srcObject !== stream) {
          console.log("[WebRTC] Received secondary video stream (likely screen share)");
          if (screenSharePreview) {
            screenSharePreview.srcObject = stream;
            
            // Trigger screen share UI if not already active
            if (!remoteScreenShareActive) {
              remoteScreenShareActive = true;
              screenStage.classList.remove("hidden");
              videoGridEl?.classList.add("minimized");
              videoAreaEl?.classList.add("screen-sharing");
              
              // Show remote participant webcam in PiP
              if (pipVideo && remoteVideo.srcObject) {
                pipVideo.srcObject = remoteVideo.srcObject;
                pipVideo.muted = false;
              }
              pip.classList.add("active");
              safePlay(pipVideo);
            }
            safePlay(screenSharePreview);
          }
        } else {
          // This is either the first stream received, or the video track for the current stream
          console.log("[WebRTC] Activating primary remote video");
          if (!remoteVideo.srcObject) {
            remoteVideo.srcObject = stream;
          }
          remoteVideo.classList.add("active");
          safePlay(remoteVideo);
        }
      } else if (event.track.kind === "audio") {
        // Audio track received; attach stream if not already attached
        if (!remoteVideo.srcObject) {
          remoteVideo.srcObject = stream;
        }
      }
    };

    pc.onnegotiationneeded = async () => {
      console.log("[WebRTC] Negotiation needed...");
      if (meeting && String(meeting.host) === String(userId)) {
        try {
          await maybeCreateOffer();
        } catch (e) {
          console.error("[WebRTC] Negotiation failed:", e);
        }
      } else {
        // Send a request to the host to initiate negotiation
        console.log("[WebRTC] Requesting host to negotiate...");
        safeJsonSend({
          type: "negotiation_needed",
          target_user_id: otherUserId,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      setStatus(`Connection: ${pc.connectionState}`);
    };

    return pc;
  }

  async function maybeCreateOffer() {
    if (!meeting || !otherUserId) return;
    // Host initiates offer
    if (String(meeting.host) !== String(userId)) return;
    const peer = ensurePeerConnection();
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    safeJsonSend({
      type: "offer",
      offer,
      target_user_id: otherUserId,
    });
  }

  async function handleOffer(msg) {
    const peer = ensurePeerConnection();
    await peer.setRemoteDescription(new RTCSessionDescription(msg.offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    safeJsonSend({
      type: "answer",
      answer,
      target_user_id: msg.sender_id,
    });
  }

  async function handleAnswer(msg) {
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
  }

  async function handleCandidate(msg) {
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
    } catch (e) {
      console.warn("ICE candidate add failed", e);
    }
  }

  function connectWebSocket() {
    const wsUrl = `${protocol()}//${window.location.host}/ws/meeting/${meeting.room_name}/`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setStatus("Connected to meeting session.");
      updateMyRowStatus();
      bc?.postMessage({ type: "meeting_joined", meetingId });
      // Start signaling after WS is open
      maybeCreateOffer().catch(console.error);

      // If we are already sharing, announce it (covers reconnect / race)
      if (isScreenSharing) {
        safeJsonSend({ type: "screen_share", active: true });
      }
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case "error":
          setStatus(msg.message || "Action not allowed.");
          break;
        case "participants_snapshot": {
          // We only support 1:1, but use this to show remote present
          const other = msg.participants?.find((p) => String(p.user_id) !== String(userId));
          if (other) {
            otherUserId = String(other.user_id);
            setRemoteLabels(other.user_name);
            // If host, create offer once we know other is present
            await maybeCreateOffer();
          }
          break;
        }
        case "participant_event": {
          if (msg.event === "joined" && String(msg.user_id) !== String(userId)) {
            otherUserId = String(msg.user_id);
            setRemoteLabels(msg.user_name);
            await maybeCreateOffer();
            // If I am sharing, tell the new participant immediately
            if (isScreenSharing) {
              safeJsonSend({ type: "screen_share", active: true });
            }
          }
          if (msg.event === "left" && String(msg.user_id) !== String(userId)) {
            setStatus(`${msg.user_name || "Participant"} left the meeting.`);
            // Hide remote tile + remove participant row
            remoteVideo.srcObject = null;
            remoteVideo.classList.remove("active");
            remoteTile?.classList.add("hidden");
            participantsList?.querySelector(`.participant-row[data-user-id="${msg.user_id}"]`)?.remove();
            updateParticipantCount();
            updateVideoLayout();
            remoteScreenShareActive = false;
            screenStage.classList.add("hidden");
            videoGridEl?.classList.remove("minimized");
            videoAreaEl?.classList.remove("screen-sharing");
            pip.classList.remove("active");
          }
          break;
        }
        case "offer":
          await handleOffer(msg);
          break;
        case "answer":
          await handleAnswer(msg);
          break;
        case "candidate":
          await handleCandidate(msg);
          break;
        case "negotiation_needed":
          console.log("[WebRTC] Received negotiation request from remote");
          if (meeting && String(meeting.host) === String(userId)) {
            maybeCreateOffer().catch(console.error);
          }
          break;
        case "chat":
          addChatMessage(msg.user_name || "Participant", (msg.user_name || "P")[0], msg.message, false, msg.file);
          break;
        case "whiteboard":
          drawRemote(msg);
          break;
        case "whiteboard_clear_own": {
          const uid = msg.sender_id || msg.user_id;
          if (uid) {
            delete strokesByUser[uid];
            renderAllStrokes();
          }
          break;
        }
        case "screen_share": {
          // Remote toggled screen share; show full-screen stage on participant side too.
          console.log("[ScreenShare] Received message:", msg);
          if (String(msg.sender_id) === String(userId)) break;
          
          const active = !!msg.active;
          const previouslyActive = remoteScreenShareActive;
          remoteScreenShareActive = active;

          if (active) {
            // Only trigger full attachment if it's a new share or if the preview is empty
            const needsAttachment = !previouslyActive || !screenSharePreview.srcObject;
            
            if (needsAttachment) {
              console.log("[ScreenShare] Starting/Refreshing remote screen share view...");
              screenStage.classList.remove("hidden");
              videoGridEl?.classList.add("minimized");
              videoAreaEl?.classList.add("screen-sharing");
              
              // Show REMOTE participant webcam in PiP during THEIR screen share
              if (pipVideo && remoteVideo?.srcObject) {
                pipVideo.srcObject = remoteVideo.srcObject;
                pipVideo.muted = false; // Hear them
              }
              pip.classList.add("active");
              await safePlay(pipVideo);
              
              // Try to attach the remote stream
              await attachRemoteVideoToScreenStageWithRetry();
            }
            
            setStatus(`${msg.user_name || "Participant"} is sharing their screen.`);
          } else {
            console.log("[ScreenShare] Stopping remote screen share view...");
            remoteScreenShareActive = false;
            if (screenSharePreview) screenSharePreview.srcObject = null;
            screenStage.classList.add("hidden");
            videoGridEl?.classList.remove("minimized");
            videoAreaEl?.classList.remove("screen-sharing");
            pip.classList.remove("active");
            setStatus("Screen sharing stopped.");
          }
          break;
        }
        case "meeting_end": {
          // Teacher ended meeting
          if (userRole === "STUDENT") {
            alert("Teacher has left/ended the meeting.");
            bc?.postMessage({ type: "meeting_ended", meetingId, data: null });
            window.location.href = "/account/student/dashboard/";
          }
          break;
        }
        case "reaction":
          showReactionOnScreen(msg.emoji);
          break;
        case "toggle_audio":
          if (msg.sender_id) {
            setMediaState(msg.sender_id, { audio: !!msg.enabled });
            updateRowStatusAndIcons(msg.sender_id);
          }
          break;
        case "toggle_video":
          if (msg.sender_id) {
            setMediaState(msg.sender_id, { video: !!msg.enabled });
            updateRowStatusAndIcons(msg.sender_id);
          }
          break;
        default:
          break;
      }
    };

    ws.onclose = () => setStatus("Disconnected from meeting session.");
    ws.onerror = () => setStatus("WebSocket error.");
  }

  // Chat
  function addChatMessage(name, avatar, message, own, file = null) {
    const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const messageDiv = document.createElement("div");
    messageDiv.className = `chat-message${own ? " own" : ""}`;
    
    let contentHtml = `<div class="chat-message-content">${escapeHtml(message)}</div>`;
    
    if (file) {
      let fileUrl = "#";
      if (file.url) {
        fileUrl = file.url;
      } else if (file.blob) {
        fileUrl = URL.createObjectURL(file.blob);
      } else if (file.data) {
        // Handle received base64 data
        try {
          const parts = file.data.split(',');
          const mime = parts[0].match(/:(.*?);/)[1];
          const bstr = atob(parts[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const blob = new Blob([u8arr], { type: mime });
          fileUrl = URL.createObjectURL(blob);
        } catch (e) {
          console.error("Failed to parse received file data:", e);
          fileUrl = file.data; // Fallback to data URL
        }
      }

      contentHtml += `
        <div class="chat-file-attachment">
          <div class="chat-file-icon"><i class="fas fa-file-alt"></i></div>
          <div class="chat-file-info">
            <div class="chat-file-name">${escapeHtml(file.name)}</div>
            <div class="chat-file-size">${escapeHtml(file.size)}</div>
          </div>
          <a href="${fileUrl}" download="${file.name}" class="chat-file-download" title="Download">
            <i class="fas fa-download"></i>
          </a>
        </div>
      `;
    }

    messageDiv.innerHTML = `
      <div class="chat-message-header">
        <div class="chat-message-avatar">${escapeHtml(avatar)}</div>
        <span>${escapeHtml(name)}</span>
      </div>
      ${contentHtml}
      <div class="chat-message-time">${escapeHtml(time)}</div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function sendChat() {
    const text = chatInput.value.trim();
    if (!text) return;
    safeJsonSend({ type: "chat", message: text });
    addChatMessage("You", (userName[0] || "Y"), text, true);
    chatInput.value = "";
  }

  // Whiteboard helpers (per-user strokes)
  let drawing = false;
  let lastX = 0;
  let lastY = 0;
  let isEraser = false;
  let strokeColor = "#f97316";
  let strokeWidth = 3;

  // Store strokes per user so "clear" can remove only own drawings
  // segments: {x1,y1,x2,y2,color,width,isEraser}
  const strokesByUser = {};

  function addSegment(uid, seg) {
    if (!uid) return;
    if (!strokesByUser[uid]) strokesByUser[uid] = [];
    strokesByUser[uid].push(seg);
  }

  function renderAllStrokes() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    Object.keys(strokesByUser).forEach((uid) => {
      const segs = strokesByUser[uid] || [];
      segs.forEach((s) => {
        drawStroke(s.x1, s.y1, s.x2, s.y2, s.color, s.width, s.isEraser);
      });
    });
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function drawStroke(x1, y1, x2, y2, color, width, eraser) {
    const computedStyle = getComputedStyle(document.documentElement);
    ctx.strokeStyle = eraser ? computedStyle.getPropertyValue("--whiteboard-bg") : color;
    ctx.lineWidth = eraser ? 18 : width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawRemote(msg) {
    const uid = msg.sender_id || msg.user_id || "unknown";
    addSegment(uid, {
      x1: msg.lastX,
      y1: msg.lastY,
      x2: msg.x,
      y2: msg.y,
      color: msg.color,
      width: msg.width,
      isEraser: !!msg.isEraser,
    });
    renderAllStrokes();
  }

  function startDraw(e) {
    e.preventDefault();
    drawing = true;
    const pos = getPos(e);
    lastX = pos.x;
    lastY = pos.y;
  }

  function draw(e) {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    addSegment(userId || "me", {
      x1: lastX,
      y1: lastY,
      x2: pos.x,
      y2: pos.y,
      color: strokeColor,
      width: strokeWidth,
      isEraser: !!isEraser,
    });
    renderAllStrokes();
    safeJsonSend({
      type: "whiteboard",
      x: pos.x,
      y: pos.y,
      lastX,
      lastY,
      isEraser,
      color: strokeColor,
      width: strokeWidth,
    });
    lastX = pos.x;
    lastY = pos.y;
  }

  function stopDraw() {
    drawing = false;
  }

  // Reactions
  function showReactionOnScreen(emoji) {
    const reaction = document.createElement("div");
    reaction.textContent = emoji;
    reaction.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 4rem;
      z-index: 2000;
      pointer-events: none;
      animation: reactionPop 1s ease-out forwards;
    `;
    document.body.appendChild(reaction);
    setTimeout(() => reaction.remove(), 1000);
  }

  // Screen share (add separate track)
  async function startScreenShare() {
    try {
      console.log("[ScreenShare] Starting screen share...");
      // Ensure we have a peer connection.
      ensurePeerConnection();
      
      // Get screen stream.
      screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { cursor: "always" }, 
        audio: true 
      });
      
      const screenTrack = screenStream.getVideoTracks()[0];
      if (screenTrack) {
        screenTrack.enabled = true;
        // Add as a separate track instead of replacing webcam
        console.log("[ScreenShare] Adding separate screen track to peer connection...");
        screenSender = pc.addTrack(screenTrack, screenStream);
        // Note: pc.addTrack will trigger pc.onnegotiationneeded automatically
      }
      
      isScreenSharing = true;
      shareBtn?.classList.add("secondary-active");
      setStatus("Screen sharing is active.");
      
      // Local preview in full stage
      if (screenSharePreview) {
        screenSharePreview.srcObject = screenStream;
        screenSharePreview.muted = true;
        await safePlay(screenSharePreview);
      }
      screenStage.classList.remove("hidden");
      videoGridEl?.classList.add("minimized");
      videoAreaEl?.classList.add("screen-sharing");
      
      // Show REMOTE participant webcam in PiP during MY screen share
      if (pipVideo && remoteVideo?.srcObject) {
        pipVideo.srcObject = remoteVideo.srcObject;
        pipVideo.muted = false; // Hear the remote participant
      }
      pip.classList.add("active");
      await safePlay(pipVideo);
      
      // Broadcast state
      safeJsonSend({ type: "screen_share", active: true });
      
      // Heartbeat
      if (screenShareHeartbeat) clearInterval(screenShareHeartbeat);
      screenShareHeartbeat = setInterval(() => {
        if (isScreenSharing) {
          safeJsonSend({ type: "screen_share", active: true });
        }
      }, 3000);
      
      screenTrack.addEventListener("ended", () => {
        console.log("[ScreenShare] Screen track ended by system/user");
        stopScreenShare().catch(console.error);
      });
    } catch (e) {
      console.error("[ScreenShare] Error starting:", e);
      setStatus("Screen sharing cancelled or failed.");
    }
  }

  async function stopScreenShare() {
    if (!isScreenSharing) return;
    console.log("[ScreenShare] Stopping screen share...");
    
    // Remove the screen track from peer connection
    if (screenSender && pc) {
      console.log("[ScreenShare] Removing screen track from peer connection...");
      pc.removeTrack(screenSender);
      screenSender = null;
      // Note: pc.removeTrack will trigger pc.onnegotiationneeded automatically
    }

    screenStream?.getTracks().forEach((t) => t.stop());
    screenStream = null;
    isScreenSharing = false;
    shareBtn?.classList.remove("secondary-active");
    setStatus("Screen sharing stopped.");
    safeJsonSend({ type: "screen_share", active: false });
    
    if (screenShareHeartbeat) {
      clearInterval(screenShareHeartbeat);
      screenShareHeartbeat = null;
    }
    
    if (screenSharePreview) screenSharePreview.srcObject = null;
    screenStage.classList.add("hidden");
    videoGridEl?.classList.remove("minimized");
    videoAreaEl?.classList.remove("screen-sharing");
    pip.classList.remove("active");
  }

  // Tabs
  function switchTab(target) {
    sidePanelTabs.forEach((t) => t.classList.remove("active"));
    document.querySelector(`[data-tab="${target}"]`)?.classList.add("active");
    participantsTab.classList.toggle("active", target === "participants");
    chatTab.classList.toggle("active", target === "chat");
    if (target === "chat") setTimeout(() => chatInput.focus(), 50);
  }

  function isDrawerMode() {
    return window.matchMedia && window.matchMedia("(max-width: 1024px)").matches;
  }

  function openDrawer(tab) {
    if (!sidePanel) return;
    sidePanel.classList.add("open");
    switchTab(tab);
  }

  function closeDrawer() {
    if (!sidePanel) return;
    sidePanel.classList.remove("open");
  }

  function wireUI() {
    // Theme toggle + timer are already in template; leave as-is.

    if (teacherStartBtn) {
      teacherStartBtn.addEventListener("click", async () => {
        const started = await startTabRecording();
        if (started) {
          if (teacherJoinModal) teacherJoinModal.style.display = "none";
          finalizeJoin();
        }
      });
    }

    // Fix record button: teacher can record
    recordBtn.addEventListener("click", async () => {
      const canRecord = userRole === "TEACHER" || String(meeting.host) === String(userId);
      if (!canRecord) {
        setStatus("Only the teacher can record.");
        return;
      }
      if (!isRecording) await startTabRecording();
      else {
        recorder?.stop();
        await uploadRecording();
      }
    });

    muteBtn.addEventListener("click", () => {
      if (!localStream) return;
      const track = localStream.getAudioTracks()[0];
      if (!track) return;
      track.enabled = !track.enabled;
      syncLocalButtonState();
      updateMyRowStatus();
      setMediaState(userId || "me", { audio: !!track.enabled });
      updateRowStatusAndIcons(userId || "me");
      safeJsonSend({ type: "toggle_audio", enabled: track.enabled });
    });

    videoBtn.addEventListener("click", () => {
      if (!localStream) return;
      const track = localStream.getVideoTracks()[0];
      if (!track) return;
      track.enabled = !track.enabled;
      if (track.enabled) videoYou.classList.add("active");
      else videoYou.classList.remove("active");
      syncLocalButtonState();
      updateMyRowStatus();
      setMediaState(userId || "me", { video: !!track.enabled });
      updateRowStatusAndIcons(userId || "me");
      safeJsonSend({ type: "toggle_video", enabled: track.enabled });
    });

    shareBtn?.addEventListener("click", () => {
      if (!pc) ensurePeerConnection();
      if (isScreenSharing) stopScreenShare().catch(console.error);
      else startScreenShare().catch(console.error);
    });

    stopScreenShareInlineBtn?.addEventListener("click", () => stopScreenShare().catch(console.error));

    whiteboardBtn.addEventListener("click", () => {
      const showing = !whiteboardArea.classList.contains("hidden");
      if (showing) {
        whiteboardArea.classList.add("hidden");
        videoArea.classList.remove("hidden");
        whiteboardBtn.classList.remove("secondary-active");
        setStatus("Back to gallery view.");
      } else {
        videoArea.classList.add("hidden");
        whiteboardArea.classList.remove("hidden");
        whiteboardBtn.classList.add("secondary-active");
        setStatus("Whiteboard is active.");
        resizeCanvas();
      }
    });

    // Reactions panel (keeps existing UX expectation)
    let reactionsPanel = null;
    reactionsBtn.addEventListener("click", () => {
      if (reactionsPanel) {
        reactionsPanel.remove();
        reactionsPanel = null;
        return;
      }
      const computedStyle = getComputedStyle(document.documentElement);
      reactionsPanel = document.createElement("div");
      reactionsPanel.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: ${computedStyle.getPropertyValue("--bg-card")};
        border: 1px solid ${computedStyle.getPropertyValue("--border-color")};
        border-radius: 0.75rem;
        z-index: 1000;
        box-shadow: ${computedStyle.getPropertyValue("--shadow-sm")};
      `;
      const reactions = ["👍", "❤️", "😂", "👏", "🎉", "🔥", "✅", "❓"];
      reactions.forEach((emoji) => {
        const btn = document.createElement("button");
        btn.textContent = emoji;
        btn.style.cssText = `
          width: 40px;
          height: 40px;
          border: none;
          background: ${computedStyle.getPropertyValue("--bg-card-alt")};
          border-radius: 0.5rem;
          font-size: 1.2rem;
          cursor: pointer;
          transition: all 0.2s;
        `;
        btn.addEventListener("mouseenter", () => {
          btn.style.background = computedStyle.getPropertyValue("--accent-blue-light");
          btn.style.transform = "scale(1.1)";
        });
        btn.addEventListener("mouseleave", () => {
          btn.style.background = computedStyle.getPropertyValue("--bg-card-alt");
          btn.style.transform = "scale(1)";
        });
        btn.addEventListener("click", () => {
          safeJsonSend({ type: "reaction", emoji });
          showReactionOnScreen(emoji);
          reactionsPanel?.remove();
          reactionsPanel = null;
        });
        reactionsPanel.appendChild(btn);
      });
      document.body.appendChild(reactionsPanel);

      setTimeout(() => {
        document.addEventListener(
          "click",
          function closePanel(e) {
            if (!reactionsPanel) return;
            if (!reactionsPanel.contains(e.target) && e.target !== reactionsBtn) {
              reactionsPanel.remove();
              reactionsPanel = null;
              document.removeEventListener("click", closePanel);
            }
          },
          { once: false }
        );
      }, 50);
    });

    // Chat tabs and send
    sidePanelTabs.forEach((tab) =>
      tab.addEventListener("click", () => {
        switchTab(tab.dataset.tab);
      })
    );

    // Drawer toggling on tablet/mobile
    chatBtn.addEventListener("click", () => {
      if (!isDrawerMode()) {
        // Desktop: toggle between tabs
        switchTab(chatTab.classList.contains("active") ? "participants" : "chat");
        return;
      }
      // Mobile/Tablet: open drawer on chat
      if (sidePanel?.classList.contains("open") && chatTab.classList.contains("active")) {
        closeDrawer();
      } else {
        openDrawer("chat");
      }
    });

    // Close drawer when clicking outside
    document.addEventListener("click", (e) => {
      if (!isDrawerMode()) return;
      if (!sidePanel?.classList.contains("open")) return;
      const within = sidePanel.contains(e.target) || e.target === chatBtn;
      if (!within) closeDrawer();
    });
    sendBtn.addEventListener("click", sendChat);
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    });

    // File attachments
    console.log("[UI] Wiring attachment button...");
    if (fileBtn) {
      fileBtn.onclick = (e) => {
        console.log("[UI] Attachment button clicked");
        fileInput?.click();
      };
    }
    
    fileInput?.addEventListener("change", (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      
      for (const file of files) {
        const reader = new FileReader();
        const fileObj = {
          name: file.name,
          size: (file.size / 1024).toFixed(1) + " KB",
          blob: file
        };

        reader.onload = (event) => {
          const base64Data = event.target.result;
          
          // Add locally first
          addChatMessage("You", (userName[0] || "Y"), "", true, fileObj);
          
          // Send to others with actual data
          safeJsonSend({ 
            type: "chat", 
            message: `Shared a file: ${file.name}`,
            file: {
              name: file.name,
              size: fileObj.size,
              data: base64Data
            }
          });
        };

        reader.onerror = (err) => {
          console.error("FileReader error:", err);
          setStatus("Failed to read file for sending.");
        };

        reader.readAsDataURL(file);
      }
      fileInput.value = ""; // Reset
    });

    // Whiteboard events
    window.addEventListener("resize", () => {
      if (!whiteboardArea.classList.contains("hidden")) resizeCanvas();
    });
    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDraw);
    canvas.addEventListener("mouseleave", stopDraw);
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDraw);
    canvas.addEventListener("touchcancel", stopDraw);

    penTool.addEventListener("click", () => {
      isEraser = false;
      penTool.classList.add("active");
      eraserTool.classList.remove("active");
      setStatus("Pen tool active.");
    });
    eraserTool.addEventListener("click", () => {
      isEraser = true;
      eraserTool.classList.add("active");
      penTool.classList.remove("active");
      setStatus("Eraser tool active.");
    });
    clearBoard.addEventListener("click", () => {
      const uid = userId || "me";
      delete strokesByUser[uid];
      renderAllStrokes();
      safeJsonSend({ type: "whiteboard_clear_own" });
      setStatus("Your whiteboard drawings cleared.");
    });
    colorPreview.addEventListener("click", () => colorPicker.click());
    colorPicker.addEventListener("input", (e) => {
      strokeColor = e.target.value;
      colorPreview.style.background = strokeColor;
    });
    colorPreview.style.background = strokeColor;

    // Leave / end meeting
    leaveBtn?.addEventListener("click", () => {
      if (!confirm("Leave this meeting?")) return;
      window.location.href = userRole === "TEACHER" ? "/account/teacher-dashboard/" : "/account/student/dashboard/";
    });

    endMeetingBtn?.addEventListener("click", async () => {
      if (!confirm("Are you sure you want to end the meeting for everyone?")) return;
      
      setStatus("Ending meeting...");

      try {
        // 1. Stop recorder
        if (recorder && isRecording) {
          recorder.stop();
          // wait a tiny bit for the stop event to populate chunks
          await new Promise(r => setTimeout(r, 500));
        }
        
        // 2. Broadcast and End on server first (to pass STATUS_COMPLETED check for upload)
        safeJsonSend({ type: "meeting_end" });
        const ended = await apiClient.endMeeting(meetingId);
        
        // 3. Upload recording if we have any
        if (recordingChunks.length > 0) {
          setStatus("Uploading recording...");
          await uploadRecording();
        }
        
        bc?.postMessage({ type: "meeting_ended", meetingId, data: ended || null });
      } catch (e) {
        console.error("Error during end meeting:", e);
      }

      window.location.href = userRole === "TEACHER" ? "/account/teacher-dashboard/" : "/account/student/dashboard/";
    });
  }

  async function init() {
    setStatus("Loading meeting...");
    initThemeToggle();
    await loadMeeting();
    setShareButtonEnabled(canShareScreen());
    wireUI();
    resizeCanvas();
    if (chatMessages) chatMessages.innerHTML = "";
    await startMediaStream();

    // Teacher Join & Auto-record logic
    if (userRole === "TEACHER" || String(meeting.host) === String(userId)) {
      if (teacherJoinModal) {
        teacherJoinModal.style.display = "flex";
      }
    } else {
      // Students just join normally
      finalizeJoin();
    }
  }

  async function finalizeJoin() {
    // Start meeting timer aligned to backend if possible
    if (meeting && String(meeting.host) === String(userId) && meeting.status === "scheduled") {
      try {
        const started = await apiClient.startMeeting(meetingId);
        if (started?.actual_start) startTimer(new Date(started.actual_start).getTime());
        else startTimer(Date.now());
      } catch (e) {
        console.error(e);
        startTimer(Date.now());
      }
    } else if (meeting?.actual_start) {
      startTimer(new Date(meeting.actual_start).getTime());
    } else {
      startTimer(Date.now());
    }

    connectWebSocket();
  }

  window.addEventListener("load", () => init().catch((e) => {
    console.error(e);
    setStatus("Failed to initialize meeting room.");
  }));

  window.addEventListener("beforeunload", (e) => {
    if (isRecording || (userRole === "TEACHER" && meeting && meeting.status !== "completed")) {
      e.preventDefault();
      e.returnValue = "Meeting is still in progress. Are you sure you want to leave? Recording might be lost if not ended properly.";
      return e.returnValue;
    }
    
    try {
      localStream?.getTracks()?.forEach((t) => t.stop());
      screenStream?.getTracks()?.forEach((t) => t.stop());
      ws?.close();
      bc?.postMessage({ type: "meeting_left", meetingId });
      bc?.close();
    } catch (e) {
      // ignore
    }
  });
})();


