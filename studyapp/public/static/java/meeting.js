/**
 * Meeting room front-end controller.
 * Handles WebRTC, meeting controls, chat, whiteboard, reactions, and status feedback.
 */

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

let meetingId = null;
let socket = null;

let localStream = null;
let screenShareStream = null;
let originalVideoTrack = null;

const peerConnections = new Map();
const remoteStreams = new Map();

let mediaRecorder = null;
let recordedChunks = [];
let startTime = null;
let timerInterval = null;

let isSharingScreen = false;
let isHandRaised = false;
let reactionPickerVisible = false;

let sidebar = null;
let reactionPickerElement = null;
let reactionBtn = null;
let chatBtn = null;
let whiteboardBtn = null;
let themeToggleButton = null;
let floatingReactionsContainer = null;
let statusToastElement = null;
let statusToastMessageElement = null;
let chatInputElement = null;
let colorPickerElement = null;
let participantCountElement = null;
let handBtn = null;
let shareBtn = null;
let recordBtn = null;
let micBtn = null;
let camBtn = null;
let sidebarResizer = null;
let documentUploadInput = null;
let uploadListElement = null;
let uploadButton = null;
let strokeSizeElement = null;

let toastTimeout = null;

let whiteboardCanvas = null;
let whiteboardContext = null;
let isDrawing = false;
let currentTool = 'draw';
let currentColor = '#000000';
let lastDrawPosition = null;
let strokeWidth = 3;
let shapeStartPosition = null;
let isResizingSidebar = false;
let resizeStartX = 0;
let startingSidebarWidth = 0;

const isSocketOpen = () => socket && socket.readyState === WebSocket.OPEN;

function sendSocketMessage(message) {
    if (!isSocketOpen()) {
        return;
    }
    socket.send(JSON.stringify(message));
}

function cacheDomReferences() {
    sidebar = document.getElementById('sidebar');
    reactionPickerElement = document.getElementById('reactionPicker');
    reactionBtn = document.getElementById('reactionBtn');
    chatBtn = document.getElementById('chatBtn');
    whiteboardBtn = document.getElementById('whiteboardBtn');
    themeToggleButton = document.getElementById('themeToggle');
    floatingReactionsContainer = document.getElementById('floatingReactions');
    statusToastElement = document.getElementById('statusToast');
    statusToastMessageElement = document.getElementById('statusToastMessage');
    chatInputElement = document.getElementById('chatInput');
    colorPickerElement = document.getElementById('colorPicker');
    participantCountElement = document.getElementById('participantCount');
    handBtn = document.getElementById('handBtn');
    shareBtn = document.getElementById('shareBtn');
    recordBtn = document.getElementById('recordBtn');
    micBtn = document.getElementById('micBtn');
    camBtn = document.getElementById('camBtn');
    whiteboardCanvas = document.getElementById('whiteboard');
    sidebarResizer = document.getElementById('sidebarResizer');
    documentUploadInput = document.getElementById('documentUpload');
    uploadListElement = document.getElementById('uploadList');
    uploadButton = document.getElementById('uploadButton');
    strokeSizeElement = document.getElementById('strokeSize');
}

function initializeUI() {
    cacheDomReferences();
    setupThemeToggle();
    setupReactionPicker();
    setupChatInput();
    setupColorPicker();
    setupStrokeSize();
    setupSidebarState();
    setupChatUploads();
    setupSidebarResizer();
    updateParticipantIndicator();
}

function setupThemeToggle() {
    if (!themeToggleButton) {
        return;
    }
    themeToggleButton.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        const icon = themeToggleButton.querySelector('i');
        const label = themeToggleButton.querySelector('.theme-label');
        if (icon) {
            icon.className = isLight ? 'fas fa-sun' : 'fas fa-moon';
        }
        if (label) {
            label.textContent = isLight ? 'Light' : 'Dark';
        }
        showStatusToast(`Switched to ${isLight ? 'light' : 'dark'} mode`);
    });
}

function setupReactionPicker() {
    if (!reactionPickerElement) {
        return;
    }

    reactionPickerElement.querySelectorAll('button').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const emoji = button.dataset.reaction || button.textContent.trim();
            sendReaction(emoji);
        });
    });

    document.addEventListener('click', (event) => {
        if (!reactionPickerVisible) {
            return;
        }
        if (reactionPickerElement.contains(event.target)) {
            return;
        }
        if (reactionBtn && reactionBtn.contains(event.target)) {
            return;
        }
        toggleReactionPicker(false);
    });
}

function setupChatInput() {
    if (!chatInputElement) {
        return;
    }
    chatInputElement.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
}

function setupColorPicker() {
    if (!colorPickerElement) {
        return;
    }
    currentColor = colorPickerElement.value || currentColor;
    colorPickerElement.addEventListener('change', (event) => {
        currentColor = event.target.value;
    });
}

function setupStrokeSize() {
    if (!strokeSizeElement) {
        return;
    }
    const parsed = parseInt(strokeSizeElement.value, 10);
    if (!Number.isNaN(parsed)) {
        strokeWidth = Math.min(20, Math.max(1, parsed));
    }
    strokeSizeElement.addEventListener('change', (event) => {
        let value = parseInt(event.target.value, 10);
        if (Number.isNaN(value)) {
            value = strokeWidth;
        }
        value = Math.min(20, Math.max(1, value));
        strokeWidth = value;
        event.target.value = value;
    });
}

function setupSidebarState() {
    if (!sidebar) {
        return;
    }
    if (window.innerWidth > 1100) {
        sidebar.classList.add('open');
    }
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1100) {
            sidebar.classList.add('open');
        }
    });
}

function ensureSidebarOpen() {
    if (!sidebar) {
        return;
    }
    sidebar.classList.add('open');
}

function setupChatUploads() {
    if (!uploadButton || !documentUploadInput || !uploadListElement) {
        return;
    }
    uploadButton.addEventListener('click', () => {
        documentUploadInput.click();
    });

    documentUploadInput.addEventListener('change', () => {
        handleFileSelection(Array.from(documentUploadInput.files || []));
    });
}

function handleFileSelection(files) {
    if (!uploadListElement) {
        return;
    }
    uploadListElement.innerHTML = '';
    if (files.length === 0) {
        return;
    }
    files.slice(0, 6).forEach((file) => {
        const item = document.createElement('li');
        item.innerHTML = `<i class="fas fa-file"></i> <span>${file.name}</span> <span style="margin-left:auto; color: var(--text-secondary);">${formatBytes(file.size)}</span>`;
        uploadListElement.appendChild(item);
    });
    if (files.length > 6) {
        const overflowItem = document.createElement('li');
        overflowItem.innerHTML = `<i class="fas fa-ellipsis-h"></i> <span>${files.length - 6} more file(s)</span>`;
        uploadListElement.appendChild(overflowItem);
    }
    showStatusToast(`${files.length} file${files.length === 1 ? '' : 's'} ready to share`);
    if (documentUploadInput) {
        documentUploadInput.value = '';
    }
}

function formatBytes(bytes) {
    if (bytes === 0) {
        return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
    return `${value} ${sizes[i]}`;
}

function setupSidebarResizer() {
    if (!sidebarResizer || !sidebar) {
        return;
    }

    const startResize = (event) => {
        if (window.innerWidth <= 1100) {
            return;
        }
        event.preventDefault();
        isResizingSidebar = true;
        resizeStartX = event.clientX;
        startingSidebarWidth = sidebar.offsetWidth;
        sidebarResizer.setPointerCapture?.(event.pointerId);
        document.body.classList.add('resizing');
        document.addEventListener('pointermove', handleResize);
        document.addEventListener('pointerup', stopResize);
    };

    const handleResize = (event) => {
        if (!isResizingSidebar) {
            return;
        }
        const delta = event.clientX - resizeStartX;
        const minWidth = 260;
        const maxWidth = 520;
        let newWidth = startingSidebarWidth - delta;
        newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
        sidebar.style.width = `${newWidth}px`;
    };

    const stopResize = (event) => {
        if (!isResizingSidebar) {
            return;
        }
        event?.preventDefault();
        document.body.classList.remove('resizing');
        sidebarResizer.releasePointerCapture?.(event.pointerId);
        document.removeEventListener('pointermove', handleResize);
        document.removeEventListener('pointerup', stopResize);
        isResizingSidebar = false;
    };

    sidebarResizer.addEventListener('pointerdown', startResize);

    window.addEventListener('resize', () => {
        if (window.innerWidth <= 1100) {
            document.documentElement.style.removeProperty('--sidebar-width');
            sidebar.style.width = '';
        }
    });
}

function showStatusToast(message) {
    if (!statusToastElement || !statusToastMessageElement) {
        console.info(message);
        return;
    }
    statusToastMessageElement.textContent = message;
    statusToastElement.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        statusToastElement.classList.remove('visible');
    }, 2200);
}

function toggleReactionPicker(forceState) {
    if (!reactionPickerElement) {
        return;
    }

    if (typeof forceState === 'boolean') {
        reactionPickerVisible = forceState;
    } else {
        reactionPickerVisible = !reactionPickerVisible;
    }

    reactionPickerElement.classList.toggle('hidden', !reactionPickerVisible);
    if (reactionBtn) {
        reactionBtn.classList.toggle('active', reactionPickerVisible);
    }
}

function sendReaction(emoji) {
    if (!emoji) {
        return;
    }
    spawnReactionBubble(emoji);
    toggleReactionPicker(false);
    sendSocketMessage({
        type: 'reaction',
        emoji
    });
}

function handleReaction(data) {
    if (!data || !data.emoji) {
        return;
    }
    spawnReactionBubble(data.emoji);
    if (data.username) {
        showStatusToast(`${data.username} reacted ${data.emoji}`);
    }
}

function spawnReactionBubble(emoji) {
    if (!floatingReactionsContainer) {
        return;
    }
    const bubble = document.createElement('span');
    bubble.className = 'reaction-bubble';
    bubble.textContent = emoji;
    bubble.style.left = `${Math.random() * 60 + 20}%`;
    floatingReactionsContainer.appendChild(bubble);
    setTimeout(() => bubble.remove(), 2400);
}

function toggleHandRaise() {
    isHandRaised = !isHandRaised;
    if (handBtn) {
        handBtn.classList.toggle('raised', isHandRaised);
    }
    const localContainer = document.getElementById('localVideoContainer');
    if (localContainer) {
        localContainer.classList.toggle('hand-raised', isHandRaised);
    }
    sendSocketMessage({
        type: 'hand_raise',
        is_raised: isHandRaised
    });
    showStatusToast(isHandRaised ? 'Hand raised' : 'Hand lowered');
}

function handleHandRaise(data) {
    const userId = data?.user_id ?? data?.from_user_id;
    if (userId == null) {
        return;
    }
    const container = document.getElementById(`video_${userId}`);
    if (container) {
        container.classList.toggle('hand-raised', Boolean(data.is_raised));
    }
    if (data.username) {
        showStatusToast(`${data.username} ${data.is_raised ? 'raised' : 'lowered'} their hand`);
    }
}

function toggleChat() {
    showTab('chat');
}

function toggleWhiteboard() {
    showTab('whiteboard');
}

function showTab(evtOrTab, maybeTabName) {
    let tabName = null;

    if (typeof evtOrTab === 'string') {
        tabName = evtOrTab;
    } else if (evtOrTab) {
        const trigger = evtOrTab.currentTarget || evtOrTab.target;
        tabName = maybeTabName || trigger?.dataset?.tab || trigger?.getAttribute('data-tab');
    }

    if (!tabName) {
        return;
    }

    document.querySelectorAll('.sidebar-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-panel').forEach((panel) => {
        panel.classList.toggle('hidden', panel.id !== `${tabName}Tab`);
    });

    ensureSidebarOpen();

    if (tabName === 'chat') {
        chatBtn?.classList.add('active');
        whiteboardBtn?.classList.remove('active');
    } else if (tabName === 'whiteboard') {
        whiteboardBtn?.classList.add('active');
        chatBtn?.classList.remove('active');
    }
}

function updateParticipantIndicator(countOverride) {
    if (!participantCountElement) {
        return;
    }
    let count = countOverride;
    if (typeof count !== 'number') {
        const videoGrid = document.getElementById('videoGrid');
        count = videoGrid ? videoGrid.querySelectorAll('.video-item').length : 0;
    }
    participantCountElement.textContent = String(count);
}

function initMeeting() {
    meetingId = window.location.pathname.split('/').slice(-2, -1)[0];
    if (!meetingId) {
        console.error('Unable to determine meeting ID from URL');
        return;
    }

    if (meetingId === 'meeting-demo') {
        startMedia();
        startTimer();
        return;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/ws/meeting/${meetingId}/`;

    socket = new WebSocket(wsUrl);

    socket.addEventListener('open', () => {
        startMedia();
        startTimer();
    });

    socket.addEventListener('message', (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('Failed to parse WebSocket message', error);
        }
    });

    socket.addEventListener('close', () => {
        handleSocketClose();
    });

    socket.addEventListener('error', (error) => {
        console.error('WebSocket error detected', error);
        showStatusToast('Connection issue detected');
    });
}

function handleSocketClose() {
    stopTimer();
    showStatusToast('Disconnected from meeting');
}

async function startMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        addLocalVideo(localStream);
        attachLocalTracksToPeers(localStream);
    } catch (error) {
        console.error('Error accessing media devices', error);
        showStatusToast('Could not access camera or microphone');
    }
}

function attachLocalTracksToPeers(stream) {
    peerConnections.forEach((pc) => {
        stream.getTracks().forEach((track) => {
            const alreadyAdded = pc.getSenders().some((sender) => sender.track && sender.track === track);
            if (!alreadyAdded) {
                pc.addTrack(track, stream);
            }
        });
    });
}

function addLocalVideo(stream) {
    const videoGrid = document.getElementById('videoGrid');
    if (!videoGrid) {
        return;
    }

    let container = document.getElementById('localVideoContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'video-item';
        container.id = 'localVideoContainer';

        const video = document.createElement('video');
        video.autoplay = true;
        video.muted = true;
        container.appendChild(video);

        const label = document.createElement('div');
        label.className = 'video-label';
        label.innerHTML = `
            <span>You</span>
            <div class="label-status">
                <span class="status-badge" id="localMicStatus"><i class="fas fa-microphone"></i></span>
                <span class="status-badge" id="localCamStatus"><i class="fas fa-video"></i></span>
            </div>
        `;
        container.appendChild(label);

        videoGrid.appendChild(container);
    }

    const videoElement = container.querySelector('video');
    if (videoElement) {
        videoElement.srcObject = stream;
    }

    updateParticipantIndicator();
}

function addRemoteVideo(stream, userId, username = '') {
    const videoGrid = document.getElementById('videoGrid');
    if (!videoGrid) {
        return;
    }

    let container = document.getElementById(`video_${userId}`);
    if (!container) {
        container = document.createElement('div');
        container.className = 'video-item';
        container.id = `video_${userId}`;
        container.dataset.userId = userId;

        const video = document.createElement('video');
        video.autoplay = true;
        container.appendChild(video);

        const label = document.createElement('div');
        label.className = 'video-label';
        label.innerHTML = `
            <span>${username || `Participant ${userId}`}</span>
            <div class="label-status">
                <span class="status-badge" id="remoteMicStatus_${userId}"><i class="fas fa-microphone"></i></span>
                <span class="status-badge" id="remoteCamStatus_${userId}"><i class="fas fa-video"></i></span>
            </div>
        `;
        container.appendChild(label);

        videoGrid.appendChild(container);
    }

    const videoElement = container.querySelector('video');
    if (videoElement) {
        videoElement.srcObject = stream;
    }

    updateParticipantIndicator();
}

function removeRemoteVideo(userId) {
    const container = document.getElementById(`video_${userId}`);
    if (container) {
        container.remove();
    }
}

function handleWebSocketMessage(data) {
    switch (data?.type) {
        case 'user_joined':
            handleUserJoined(data);
            break;
        case 'user_left':
            handleUserLeft(data);
            break;
        case 'chat':
            handleChatMessage(data);
            break;
        case 'webrtc':
        case 'webrtc_signal':
            handleWebRTCSignal(data);
            break;
        case 'screen_share':
            handleScreenShare(data);
            break;
        case 'recording':
        case 'recording_status':
            handleRecordingStatus(data);
            break;
        case 'whiteboard':
            handleWhiteboard(data);
            break;
        case 'reaction':
            handleReaction(data);
            break;
        case 'hand_raise':
            handleHandRaise(data);
            break;
        case 'participant_update':
            updateParticipantIndicator(data.count);
            break;
        default:
            console.debug('Unhandled meeting message', data);
    }
}

function handleUserJoined(data) {
    const userId = data?.user_id;
    if (!userId) {
        return;
    }
    createPeerConnection(userId, data.username, true);
    updateParticipantIndicator();
    if (data.username) {
        showStatusToast(`${data.username} joined the meeting`);
    }
}

function handleUserLeft(data) {
    const userId = data?.user_id;
    if (!userId) {
        return;
    }
    removeRemoteVideo(userId);
    const pc = peerConnections.get(userId);
    if (pc) {
        pc.close();
        peerConnections.delete(userId);
    }
    remoteStreams.delete(userId);
    updateParticipantIndicator();
    if (data.username) {
        showStatusToast(`${data.username} left the meeting`);
    }
}

function createPeerConnection(userId, username = '', createOffer = false) {
    if (peerConnections.has(userId)) {
        return peerConnections.get(userId);
    }

    const pc = new RTCPeerConnection(configuration);
    peerConnections.set(userId, pc);

    if (localStream) {
        localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
        });
    }

    pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (remoteStream) {
            remoteStreams.set(userId, remoteStream);
            addRemoteVideo(remoteStream, userId, username);
        }
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            sendSocketMessage({
                type: 'webrtc_signal',
                target_user_id: userId,
                signal: {
                    type: 'ice-candidate',
                    candidate: event.candidate
                }
            });
        }
    };

    pc.onconnectionstatechange = () => {
        if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
            removeRemoteVideo(userId);
            peerConnections.delete(userId);
            remoteStreams.delete(userId);
            updateParticipantIndicator();
        }
    };

    if (createOffer) {
        pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer))
            .then(() => {
                sendSocketMessage({
                    type: 'webrtc_signal',
                    target_user_id: userId,
                    signal: {
                        type: 'offer',
                        offer: pc.localDescription
                    }
                });
            })
            .catch((error) => console.error('Failed to create offer', error));
    }

    return pc;
}

function handleWebRTCSignal(data) {
    const signal = data.signal;
    const fromUserId = data.from_user_id ?? data.user_id ?? data.source_user_id;
    if (!signal || !fromUserId) {
        return;
    }

    let pc = peerConnections.get(fromUserId);
    if (!pc) {
        pc = createPeerConnection(fromUserId, data.username, false);
    }

    if (signal.type === 'offer') {
        pc.setRemoteDescription(new RTCSessionDescription(signal.offer))
            .then(() => pc.createAnswer())
            .then((answer) => pc.setLocalDescription(answer))
            .then(() => {
                sendSocketMessage({
                    type: 'webrtc_signal',
                    target_user_id: fromUserId,
                    signal: {
                        type: 'answer',
                        answer: pc.localDescription
                    }
                });
            })
            .catch((error) => console.error('Error handling offer', error));
    } else if (signal.type === 'answer') {
        pc.setRemoteDescription(new RTCSessionDescription(signal.answer))
            .catch((error) => console.error('Error setting remote description', error));
    } else if (signal.type === 'ice-candidate' && signal.candidate) {
        pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
            .catch((error) => console.error('Error adding ICE candidate', error));
    }
}

function handleChatMessage(data) {
    const container = document.getElementById('chatMessages');
    if (!container) {
        return;
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';

    const header = document.createElement('div');
    header.className = 'chat-message-header';
    header.textContent = data.username || 'Participant';

    const body = document.createElement('div');
    body.textContent = data.message || '';

    messageDiv.appendChild(header);
    messageDiv.appendChild(body);
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function sendMessage() {
    if (!chatInputElement) {
        return;
    }
    const message = chatInputElement.value.trim();
    if (!message) {
        return;
    }
    sendSocketMessage({
        type: 'chat',
        message
    });
    chatInputElement.value = '';
}

function setStatusBadge(elementId, isEnabled, disabledClass, enabledIcon, disabledIcon) {
    const badge = document.getElementById(elementId);
    if (!badge) {
        return;
    }
    badge.classList.toggle(disabledClass, !isEnabled);
    const icon = badge.querySelector('i');
    if (icon) {
        icon.className = isEnabled ? enabledIcon : disabledIcon;
    }
}

function toggleMic() {
    if (!localStream) {
        return;
    }
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) {
        showStatusToast('No microphone detected');
        return;
    }
    audioTrack.enabled = !audioTrack.enabled;
    micBtn?.classList.toggle('muted', !audioTrack.enabled);
    setStatusBadge('localMicStatus', audioTrack.enabled, 'muted', 'fas fa-microphone', 'fas fa-microphone-slash');
    showStatusToast(audioTrack.enabled ? 'Microphone unmuted' : 'Microphone muted');
}

function toggleCam() {
    if (!localStream) {
        return;
    }
    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) {
        showStatusToast('No camera detected');
        return;
    }
    videoTrack.enabled = !videoTrack.enabled;
    camBtn?.classList.toggle('off', !videoTrack.enabled);
    setStatusBadge('localCamStatus', videoTrack.enabled, 'video-off', 'fas fa-video', 'fas fa-video-slash');
    showStatusToast(videoTrack.enabled ? 'Camera turned on' : 'Camera turned off');
}

function replaceOutgoingVideoTrack(newTrack) {
    peerConnections.forEach((pc) => {
        const sender = pc.getSenders().find((item) => item.track && item.track.kind === 'video');
        if (sender) {
            sender.replaceTrack(newTrack).catch((error) => console.error('Error replacing outgoing track', error));
        }
    });
}

async function toggleScreenShare() {
    if (isSharingScreen) {
        stopScreenShare({ notifyServer: true });
        return;
    }

    try {
        screenShareStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const screenTrack = screenShareStream.getVideoTracks()[0];
        if (!screenTrack) {
            showStatusToast('Unable to share screen');
            return;
        }

        originalVideoTrack = localStream?.getVideoTracks()[0] || null;
        replaceOutgoingVideoTrack(screenTrack);

        const localVideo = document.querySelector('#localVideoContainer video');
        if (localVideo) {
            localVideo.srcObject = screenShareStream;
        }

        screenTrack.onended = () => stopScreenShare({ notifyServer: true });

        isSharingScreen = true;
        shareBtn?.classList.add('sharing');

        sendSocketMessage({
            type: 'screen_share',
            is_sharing: true
        });

        showStatusToast('Screen sharing started');
    } catch (error) {
        console.error('Error starting screen share', error);
        showStatusToast('Screen share was cancelled');
    }
}

function stopScreenShare(options = {}) {
    const { notifyServer = true } = options;
    if (!isSharingScreen) {
        return;
    }

    if (screenShareStream) {
        screenShareStream.getTracks().forEach((track) => track.stop());
        screenShareStream = null;
    }

    const fallbackTrack = originalVideoTrack || localStream?.getVideoTracks()[0] || null;
    if (fallbackTrack) {
        replaceOutgoingVideoTrack(fallbackTrack);
    }

    const localVideo = document.querySelector('#localVideoContainer video');
    if (localVideo) {
        localVideo.srcObject = localStream || null;
    }

    isSharingScreen = false;
    shareBtn?.classList.remove('sharing');

    if (notifyServer) {
        sendSocketMessage({
            type: 'screen_share',
            is_sharing: false
        });
    }

    showStatusToast('Screen sharing stopped');
}

function handleScreenShare(data) {
    const userId = data?.user_id ?? data?.from_user_id;
    if (userId == null) {
        return;
    }
    const container = document.getElementById(`video_${userId}`);
    if (container) {
        container.classList.toggle('screen-sharing', Boolean(data.is_sharing));
    }
    if (data?.username) {
        showStatusToast(`${data.username} ${data.is_sharing ? 'started' : 'stopped'} sharing their screen`);
    }
}

function toggleRecording() {
    if (recordBtn && recordBtn.classList.contains('recording')) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    if (!localStream) {
        showStatusToast('Start your camera before recording');
        return;
    }
    if (typeof MediaRecorder === 'undefined') {
        showStatusToast('Recording not supported in this browser');
        return;
    }
    try {
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(localStream, { mimeType: 'video/webm;codecs=vp8,opus' });
    } catch (error) {
        console.error('Unable to start media recorder', error);
        showStatusToast('Unable to start recording');
        return;
    }

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        console.info('Recording finished', blob);
    };

    mediaRecorder.start();
    recordBtn?.classList.add('recording');

    sendSocketMessage({
        type: 'recording_status',
        is_recording: true
    });

    showStatusToast('Recording started');
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    recordBtn?.classList.remove('recording');

    sendSocketMessage({
        type: 'recording_status',
        is_recording: false
    });

    showStatusToast('Recording stopped');
}

function handleRecordingStatus(data) {
    const isRecording = Boolean(data?.is_recording);
    if (recordBtn) {
        recordBtn.classList.toggle('recording', isRecording);
    }
    if (data?.username) {
        showStatusToast(`${data.username} ${isRecording ? 'started' : 'stopped'} recording`);
    }
}

function leaveMeeting() {
    if (!confirm('Are you sure you want to leave the meeting?')) {
        return;
    }

    stopTimer();
    stopScreenShare({ notifyServer: true });

    if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
    }

    peerConnections.forEach((pc) => pc.close());
    peerConnections.clear();
    remoteStreams.clear();

    if (socket) {
        socket.close();
    }

    window.location.href = '/meetings/';
}

function startTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const hours = Math.floor(elapsed / 3600000).toString().padStart(2, '0');
        const minutes = Math.floor((elapsed % 3600000) / 60000).toString().padStart(2, '0');
        const seconds = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
        const timerElement = document.getElementById('timer');
        if (timerElement) {
            timerElement.textContent = `${hours}:${minutes}:${seconds}`;
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function initWhiteboard() {
    if (!whiteboardCanvas) {
        return;
    }

    const parent = whiteboardCanvas.parentElement;
    whiteboardContext = whiteboardCanvas.getContext('2d');
    whiteboardCanvas.width = parent ? parent.clientWidth : 800;
    whiteboardCanvas.height = 480;

    whiteboardCanvas.addEventListener('pointerdown', startDraw);
    whiteboardCanvas.addEventListener('pointermove', draw);
    whiteboardCanvas.addEventListener('pointerup', stopDraw);
    whiteboardCanvas.addEventListener('pointerleave', stopDraw);
    whiteboardCanvas.addEventListener('pointercancel', stopDraw);
}

function getCanvasCoordinates(event) {
    const rect = whiteboardCanvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function setTool(event, tool) {
    if (event?.preventDefault) {
        event.preventDefault();
    }
    currentTool = tool;
    shapeStartPosition = null;
    document.querySelectorAll('.whiteboard-tool').forEach((button) => {
        button.classList.toggle('active', button.dataset.tool === tool);
    });
}

function startDraw(event) {
    if (!whiteboardContext) {
        return;
    }
    event.preventDefault();
    const coords = getCanvasCoordinates(event);
    if (currentTool === 'text') {
        addTextToWhiteboard(coords);
        return;
    }
    isDrawing = true;
    whiteboardCanvas.setPointerCapture?.(event.pointerId);
    shapeStartPosition = coords;
    lastDrawPosition = coords;
    if (currentTool === 'draw' || currentTool === 'erase') {
        whiteboardContext.beginPath();
        whiteboardContext.moveTo(coords.x, coords.y);
    }
}

function draw(event) {
    if (!isDrawing || !whiteboardContext) {
        return;
    }
    event.preventDefault();
    const coords = getCanvasCoordinates(event);

    if (currentTool === 'draw' || currentTool === 'erase') {
        whiteboardContext.lineJoin = 'round';
        whiteboardContext.lineCap = 'round';

        if (currentTool === 'erase') {
            const eraseWidth = Math.max(24, strokeWidth * 4);
            whiteboardContext.save();
            whiteboardContext.globalCompositeOperation = 'destination-out';
            whiteboardContext.lineWidth = eraseWidth;
            whiteboardContext.lineTo(coords.x, coords.y);
            whiteboardContext.stroke();
            whiteboardContext.restore();
            if (lastDrawPosition) {
                broadcastWhiteboardStroke(lastDrawPosition, coords, 'erase', currentColor, eraseWidth);
            }
        } else {
            whiteboardContext.strokeStyle = currentColor;
            whiteboardContext.lineWidth = strokeWidth;
            whiteboardContext.lineTo(coords.x, coords.y);
            whiteboardContext.stroke();
            if (lastDrawPosition) {
                broadcastWhiteboardStroke(lastDrawPosition, coords, 'draw', currentColor, strokeWidth);
            }
        }

        whiteboardContext.beginPath();
        whiteboardContext.moveTo(coords.x, coords.y);
    }

    lastDrawPosition = coords;
}

function stopDraw(event) {
    if (!isDrawing) {
        return;
    }
    event?.preventDefault();
    whiteboardCanvas.releasePointerCapture?.(event.pointerId);
    const endPosition = getCanvasCoordinates(event);

    if (currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'line') {
        drawShape(shapeStartPosition, endPosition, currentTool, currentColor, strokeWidth);
        broadcastWhiteboardShape(shapeStartPosition, endPosition, currentTool, currentColor, strokeWidth);
    }

    isDrawing = false;
    lastDrawPosition = null;
    shapeStartPosition = null;
    if (currentTool === 'draw' || currentTool === 'erase') {
        whiteboardContext.beginPath();
    }
}

function broadcastWhiteboardStroke(start, end, tool, color, lineWidth) {
    if (!start || !end) {
        return;
    }
    sendSocketMessage({
        type: 'whiteboard',
        action: 'stroke',
        start,
        end,
        tool,
        color,
        lineWidth
    });
}

function broadcastWhiteboardShape(start, end, shape, color, lineWidth) {
    if (!start || !end) {
        return;
    }
    sendSocketMessage({
        type: 'whiteboard',
        action: 'shape',
        shape,
        start,
        end,
        color,
        lineWidth
    });
}

function broadcastWhiteboardText(position, text, color, fontSize) {
    sendSocketMessage({
        type: 'whiteboard',
        action: 'text',
        position,
        text,
        color,
        fontSize
    });
}

function drawRemoteStroke(start, end, tool = 'draw', color = '#000000', lineWidth = 3) {
    if (!whiteboardContext || !start || !end) {
        return;
    }
    whiteboardContext.save();
    whiteboardContext.lineJoin = 'round';
    whiteboardContext.lineCap = 'round';

    if (tool === 'erase') {
        whiteboardContext.globalCompositeOperation = 'destination-out';
        whiteboardContext.lineWidth = lineWidth || 24;
    } else {
        whiteboardContext.globalCompositeOperation = 'source-over';
        whiteboardContext.strokeStyle = color || '#000000';
        whiteboardContext.lineWidth = lineWidth || strokeWidth;
    }

    whiteboardContext.beginPath();
    whiteboardContext.moveTo(start.x, start.y);
    whiteboardContext.lineTo(end.x, end.y);
    whiteboardContext.stroke();
    whiteboardContext.restore();
}

function drawShape(start, end, shape, color, lineWidth = 3) {
    if (!whiteboardContext || !start || !end) {
        return;
    }
    whiteboardContext.save();
    whiteboardContext.lineJoin = 'round';
    whiteboardContext.lineCap = 'round';
    whiteboardContext.strokeStyle = color || currentColor;
    whiteboardContext.lineWidth = lineWidth || strokeWidth;
    whiteboardContext.globalCompositeOperation = 'source-over';

    if (shape === 'rectangle') {
        const width = end.x - start.x;
        const height = end.y - start.y;
        whiteboardContext.strokeRect(start.x, start.y, width, height);
    } else if (shape === 'circle') {
        const radius = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
        whiteboardContext.beginPath();
        whiteboardContext.arc(start.x, start.y, radius, 0, Math.PI * 2);
        whiteboardContext.stroke();
    } else if (shape === 'line') {
        whiteboardContext.beginPath();
        whiteboardContext.moveTo(start.x, start.y);
        whiteboardContext.lineTo(end.x, end.y);
        whiteboardContext.stroke();
    }

    whiteboardContext.restore();
}

function drawRemoteShape(data) {
    drawShape(data.start, data.end, data.shape, data.color, data.lineWidth);
}

function addTextToWhiteboard(position) {
    const text = prompt('Enter text to add to the whiteboard:');
    if (!text || !whiteboardContext) {
        return;
    }
    const fontSize = Math.max(14, strokeWidth * 5);
    whiteboardContext.save();
    whiteboardContext.fillStyle = currentColor;
    whiteboardContext.font = `${fontSize}px "Inter", sans-serif`;
    whiteboardContext.textBaseline = 'top';
    whiteboardContext.fillText(text, position.x, position.y);
    whiteboardContext.restore();
    broadcastWhiteboardText(position, text, currentColor, fontSize);
}

function drawRemoteText(data) {
    if (!whiteboardContext || !data?.position || !data?.text) {
        return;
    }
    const fontSize = data.fontSize || Math.max(14, strokeWidth * 5);
    whiteboardContext.save();
    whiteboardContext.fillStyle = data.color || currentColor;
    whiteboardContext.font = `${fontSize}px "Inter", sans-serif`;
    whiteboardContext.textBaseline = 'top';
    whiteboardContext.fillText(data.text, data.position.x, data.position.y);
    whiteboardContext.restore();
}

function handleWhiteboard(data) {
    if (!data) {
        return;
    }
    if (data.action === 'clear') {
        clearWhiteboardCanvas();
        if (data.username) {
            showStatusToast(`${data.username} cleared the whiteboard`);
        }
        return;
    }
    if (data.action === 'stroke') {
        drawRemoteStroke(data.start, data.end, data.tool, data.color, data.lineWidth);
        return;
    }
    if (data.action === 'shape') {
        drawRemoteShape(data);
        return;
    }
    if (data.action === 'text') {
        drawRemoteText(data);
    }
}

function clearWhiteboardCanvas() {
    if (!whiteboardCanvas || !whiteboardContext) {
        return;
    }
    whiteboardContext.clearRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
}

function clearWhiteboard() {
    if (!whiteboardContext) {
        return;
    }
    if (!confirm('Clear the entire whiteboard for everyone?')) {
        return;
    }
    clearWhiteboardCanvas();
    sendSocketMessage({
        type: 'whiteboard',
        action: 'clear'
    });
}

window.addEventListener('load', () => {
    initializeUI();
    initWhiteboard();
    initMeeting();
});

window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.close();
    }
    if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
    }
});
