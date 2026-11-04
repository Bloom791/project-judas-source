const JudasApp = {
    currentUser: null,
    currentProfile: null,
    currentConversation: null,
    currentConversationData: null,
    currentConversationMembers: [],
    currentReadStatus: null,
    messageChannel: null,
    conversationChannel: null,
    currentPage: "messages",
    loadingMessages: false,
    markingRead: false,
    root: document.getElementById("app"),

    async init() {
        if (!this.root) {
            console.error("Project Judas: #app element not found.");
            return;
        }

        this.showLoading();

        const session = await JudasAuth.getSession();

        if (session) {
            await this.loadUser(session.user);
        } else {
            this.showAuthentication();
        }

        JudasAuth.onAuthStateChange(async (event, session) => {
            if (event === "SIGNED_OUT") {
                await this.closeMessageSubscription();
                await this.closeConversationSubscription();
                this.currentUser = null;
                this.currentProfile = null;
                this.currentConversation = null;
                this.showAuthentication();
            }

            if (event === "SIGNED_IN" && session) {
                await this.loadUser(session.user);
            }
        });
    },

    showLoading() {
        this.root.innerHTML = `
            <div class="empty-state">
                <h2>PROJECT JUDAS</h2>
                <p>Connecting to secure servers...</p>
                <div class="loading">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
    },

    notify(message) {
        const oldNotification = document.querySelector(".notification");

        if (oldNotification) {
            oldNotification.remove();
        }

        const notification = document.createElement("div");
        notification.className = "notification";
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3500);
    },

    async closeMessageSubscription() {
        if (this.messageChannel) {
            await supabaseClient.removeChannel(this.messageChannel);
            this.messageChannel = null;
        }
    },

    async closeConversationSubscription() {
        if (this.conversationChannel) {
            await supabaseClient.removeChannel(this.conversationChannel);
            this.conversationChannel = null;
        }
    },

    async startConversationSubscription() {
        await this.closeConversationSubscription();

        this.conversationChannel = supabaseClient
            .channel("conversation-list-" + this.currentUser.id)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages"
                },
                payload => {
                    const message = payload.new;

                    if (
                        message.sender_id !== this.currentUser.id &&
                        this.currentPage !== "users" &&
                        this.currentPage !== "profile" &&
                        this.currentPage !== "settings" &&
                        this.currentPage !== "announcements"
                    ) {
                        if (!this.currentConversation) {
                            this.loadConversations(false);
                        } else if (
                            message.conversation_id !== this.currentConversation
                        ) {
                            this.loadConversations(false);
                        }
                    }
                }
            )
            .subscribe(status => {
                if (status === "CHANNEL_ERROR") {
                    console.error("Conversation notification connection failed.");
                }
            });
    },

    showAuthentication() {
        this.root.innerHTML = `
            <div style="
                width:100%;
                min-height:100vh;
                display:flex;
                align-items:center;
                justify-content:center;
                padding:20px;
            ">
                <div class="form-container">
                    <div style="text-align:center;margin-bottom:30px;">
                        <h1 class="logo">PROJECT JUDAS</h1>
                        <p style="
                            color:var(--text-muted);
                            font-size:10px;
                            margin-top:12px;
                            letter-spacing:2px;
                        ">
                            SECURE COMMUNICATION NETWORK
                        </p>
                    </div>
                    <div id="auth-form"></div>
                </div>
            </div>
        `;

        this.showLoginForm();
    },

    showLoginForm() {
        const form = document.getElementById("auth-form");

        form.innerHTML = `
            <h2 class="form-title">WELCOME BACK</h2>
            <p class="form-description">
                Sign in to access your Project Judas account.
            </p>

            <form id="login-form">
                <div class="form-group">
                    <label class="form-label">EMAIL ADDRESS</label>
                    <input
                        class="form-input"
                        id="login-email"
                        type="email"
                        placeholder="Enter your email"
                        autocomplete="email"
                        required
                    >
                </div>

                <div class="form-group">
                    <label class="form-label">PASSWORD</label>
                    <input
                        class="form-input"
                        id="login-password"
                        type="password"
                        placeholder="Enter your password"
                        autocomplete="current-password"
                        required
                    >
                </div>

                <p
                    id="login-error"
                    style="color:var(--danger);font-size:11px;margin-bottom:15px;"
                ></p>

                <button class="btn btn-primary" type="submit" style="width:100%;">
                    SIGN IN
                </button>
            </form>

            <p style="
                text-align:center;
                color:var(--text-muted);
                font-size:11px;
                margin-top:25px;
            ">
                Don't have an account?
                <button
                    id="show-register"
                    class="btn"
                    type="button"
                    style="margin-left:5px;"
                >
                    REGISTER
                </button>
            </p>
        `;

        document.getElementById("login-form").addEventListener("submit", async event => {
            event.preventDefault();

            const email = document.getElementById("login-email").value.trim();
            const password = document.getElementById("login-password").value;
            const button = event.currentTarget.querySelector("button[type='submit']");
            const errorBox = document.getElementById("login-error");

            button.disabled = true;
            button.textContent = "SIGNING IN...";

            const result = await JudasAuth.login(email, password);

            if (!result.success) {
                errorBox.textContent = result.message;
                button.disabled = false;
                button.textContent = "SIGN IN";
                return;
            }

            await this.loadUser(result.user);
        });

        document.getElementById("show-register").addEventListener(
            "click",
            () => this.showRegisterForm()
        );
    },

    showRegisterForm() {
        const form = document.getElementById("auth-form");

        form.innerHTML = `
            <h2 class="form-title">CREATE ACCOUNT</h2>
            <p class="form-description">
                Create your Project Judas account to get started.
            </p>

            <form id="register-form">
                <div class="form-group">
                    <label class="form-label">EMAIL ADDRESS</label>
                    <input
                        class="form-input"
                        id="register-email"
                        type="email"
                        placeholder="Enter your email"
                        autocomplete="email"
                        required
                    >
                </div>

                <div class="form-group">
                    <label class="form-label">PASSWORD</label>
                    <input
                        class="form-input"
                        id="register-password"
                        type="password"
                        placeholder="At least 8 characters"
                        minlength="8"
                        autocomplete="new-password"
                        required
                    >
                </div>

                <div class="form-group">
                    <label class="form-label">CONFIRM PASSWORD</label>
                    <input
                        class="form-input"
                        id="register-confirm"
                        type="password"
                        placeholder="Enter your password again"
                        minlength="8"
                        autocomplete="new-password"
                        required
                    >
                </div>

                <p
                    id="register-error"
                    style="color:var(--danger);font-size:11px;margin-bottom:15px;"
                ></p>

                <button class="btn btn-primary" type="submit" style="width:100%;">
                    CREATE ACCOUNT
                </button>
            </form>

            <p style="
                text-align:center;
                color:var(--text-muted);
                font-size:11px;
                margin-top:25px;
            ">
                Already registered?
                <button
                    id="show-login"
                    class="btn"
                    type="button"
                    style="margin-left:5px;"
                >
                    SIGN IN
                </button>
            </p>
        `;

        document.getElementById("register-form").addEventListener("submit", async event => {
            event.preventDefault();

            const email = document.getElementById("register-email").value.trim();
            const password = document.getElementById("register-password").value;
            const confirm = document.getElementById("register-confirm").value;
            const button = event.currentTarget.querySelector("button[type='submit']");
            const errorBox = document.getElementById("register-error");

            if (password !== confirm) {
                errorBox.textContent = "Your passwords do not match.";
                return;
            }

            button.disabled = true;
            button.textContent = "CREATING ACCOUNT...";

            const result = await JudasAuth.register(email, password);

            if (!result.success) {
                errorBox.textContent = result.message;
                button.disabled = false;
                button.textContent = "CREATE ACCOUNT";
                return;
            }

            if (result.session) {
                await this.loadUser(result.user);
                return;
            }

            form.innerHTML = `
                <h2 class="form-title">CHECK YOUR EMAIL</h2>
                <p class="form-description">
                    Your account has been created.
                    A confirmation link has been sent to:
                </p>

                <p style="
                    color:var(--green);
                    font-size:12px;
                    margin-bottom:20px;
                    overflow-wrap:anywhere;
                "></p>

                <p class="form-description">
                    Confirm your email, then return here and sign in.
                </p>

                <button
                    class="btn btn-primary"
                    id="return-login"
                    style="width:100%;"
                >
                    RETURN TO LOGIN
                </button>
            `;

            form.querySelector("p[style*='overflow-wrap']").textContent = email;

            document.getElementById("return-login").addEventListener(
                "click",
                () => this.showLoginForm()
            );
        });

        document.getElementById("show-login").addEventListener(
            "click",
            () => this.showLoginForm()
        );
    },

    async loadUser(user) {
        if (!user) {
            this.showAuthentication();
            return;
        }

        this.currentUser = user;
        this.showLoading();

        let profile = null;

        for (let attempt = 0; attempt < 5; attempt++) {
            const { data, error } = await supabaseClient
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .maybeSingle();

            if (error) {
                console.error("Profile loading error:", error);
                this.notify("Could not load your profile.");
                return;
            }

            if (data) {
                profile = data;
                break;
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (!profile) {
            this.root.innerHTML = `
                <div class="empty-state">
                    <h2>PROFILE NOT FOUND</h2>
                    <p>Your account exists, but its profile could not be loaded.</p>
                </div>
            `;
            return;
        }

        this.currentProfile = profile;

        if (!profile.username) {
            this.showProfileSetup();
            return;
        }

        await this.showDashboard();
    },

    showProfileSetup() {
        this.root.innerHTML = `
            <div style="
                width:100%;
                min-height:100vh;
                display:flex;
                justify-content:center;
                align-items:center;
                padding:20px;
                overflow-y:auto;
            ">
                <div class="form-container" style="max-width:500px;">
                    <h2 class="form-title">SET UP YOUR PROFILE</h2>

                    <p class="form-description">
                        Before entering Project Judas, choose how other users
                        will see you.
                    </p>

                    <form id="profile-setup-form">
                        <div class="form-group">
                            <label class="form-label">USERNAME</label>
                            <input
                                class="form-input"
                                id="profile-username"
                                type="text"
                                minlength="3"
                                maxlength="24"
                                pattern="[A-Za-z0-9_]+"
                                placeholder="Your unique username"
                                required
                            >
                            <p style="color:var(--text-muted);font-size:10px;margin-top:6px;">
                                3–24 characters. Letters, numbers, and underscores.
                            </p>
                        </div>

                        <div class="form-group">
                            <label class="form-label">DISPLAY NAME</label>
                            <input
                                class="form-input"
                                id="profile-display-name"
                                type="text"
                                maxlength="40"
                                placeholder="How should people see your name?"
                                required
                            >
                        </div>

                        <div class="form-group">
                            <label class="form-label">BIO</label>
                            <textarea
                                class="form-textarea"
                                id="profile-bio"
                                maxlength="300"
                                placeholder="Tell people a little about yourself..."
                            ></textarea>
                            <p style="color:var(--text-muted);font-size:10px;margin-top:6px;">
                                Maximum 300 characters.
                            </p>
                        </div>

                        <div class="form-group">
                            <label class="form-label">PRONOUNS (OPTIONAL)</label>
                            <input
                                class="form-input"
                                id="profile-pronouns"
                                type="text"
                                maxlength="40"
                                placeholder="e.g. they/them"
                            >
                        </div>

                        <div class="form-group">
                            <label class="form-label">PROFILE PICTURE (OPTIONAL)</label>
                            <input
                                class="form-input"
                                id="profile-avatar"
                                type="file"
                                accept="image/*"
                            >
                            <p style="color:var(--text-muted);font-size:10px;margin-top:6px;">
                                Maximum file size: 10 MB.
                            </p>
                        </div>

                        <p
                            id="profile-error"
                            style="color:var(--danger);font-size:11px;margin-bottom:15px;"
                        ></p>

                        <button
                            class="btn btn-primary"
                            type="submit"
                            style="width:100%;"
                        >
                            COMPLETE PROFILE
                        </button>
                    </form>
                </div>
            </div>
        `;

        document.getElementById("profile-setup-form").addEventListener("submit", async event => {
            event.preventDefault();

            const username = document.getElementById("profile-username").value.trim();
            const displayName = document.getElementById("profile-display-name").value.trim();
            const bio = document.getElementById("profile-bio").value.trim();
            const pronouns = document.getElementById("profile-pronouns").value.trim();
            const avatarInput = document.getElementById("profile-avatar");
            const errorBox = document.getElementById("profile-error");
            const button = event.currentTarget.querySelector("button[type='submit']");

            if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
                errorBox.textContent = "Username must be 3–24 characters and use only letters, numbers, or underscores.";
                return;
            }

            if (!displayName || displayName.length > 40) {
                errorBox.textContent = "Please enter a display name (maximum 40 characters).";
                return;
            }

            if (bio.length > 300 || pronouns.length > 40) {
                errorBox.textContent = "Your bio or pronouns are too long.";
                return;
            }

            const avatarFile = avatarInput.files[0];

            if (avatarFile) {
                if (!avatarFile.type.startsWith("image/")) {
                    errorBox.textContent = "Please choose an image file.";
                    return;
                }

                if (avatarFile.size > 10 * 1024 * 1024) {
                    errorBox.textContent = "Your profile picture must be 10 MB or smaller.";
                    return;
                }
            }

            button.disabled = true;
            button.textContent = "SAVING PROFILE...";

            let avatarPath = null;

            try {
                if (avatarFile) {
                    const extension = avatarFile.name.split(".").pop().toLowerCase();
                    avatarPath = `${this.currentUser.id}/avatar.${extension}`;

                    const { error: uploadError } = await supabaseClient
                        .storage
                        .from("avatars")
                        .upload(avatarPath, avatarFile, {
                            upsert: true,
                            contentType: avatarFile.type
                        });

                    if (uploadError) {
                        throw uploadError;
                    }
                }

                const updates = {
                    username,
                    display_name: displayName,
                    bio,
                    pronouns,
                    avatar_url: avatarPath
                };

                const { data, error } = await supabaseClient
                    .from("profiles")
                    .update(updates)
                    .eq("id", this.currentUser.id)
                    .select()
                    .single();

                if (error) {
                    throw error;
                }

                this.currentProfile = data;
                this.notify("Profile created successfully!");
                await this.showDashboard();

            } catch (error) {
                console.error("Profile setup error:", error);

                if (error.code === "23505") {
                    errorBox.textContent = "That username is already taken. Please choose another.";
                } else {
                    errorBox.textContent = error.message;
                }

                button.disabled = false;
                button.textContent = "COMPLETE PROFILE";
            }
        });
    },

    async showDashboard() {
        const profile = this.currentProfile;

        this.root.innerHTML = `
            <div class="app-container">
                <aside class="sidebar">
                    <div class="sidebar-header">
                        <div class="logo">JUDAS</div>
                        <div class="logo-subtitle">COMMUNICATION NETWORK</div>
                    </div>

                    <nav class="sidebar-navigation">
                        <div class="nav-label">COMMUNICATION</div>

                        <button class="nav-item active" data-page="messages">
                            <span class="nav-icon">✉</span>
                            <span class="nav-text">Messages</span>
                        </button>

                        <button class="nav-item" data-page="groups">
                            <span class="nav-icon">▣</span>
                            <span class="nav-text">Group Chats</span>
                        </button>

                        <button class="nav-item" data-page="users">
                            <span class="nav-icon">⌕</span>
                            <span class="nav-text">Find Users</span>
                        </button>

                        <div class="nav-label">OTHER</div>

                        <button class="nav-item" data-page="announcements">
                            <span class="nav-icon">▤</span>
                            <span class="nav-text">Announcements</span>
                        </button>

                        <button class="nav-item" data-page="profile">
                            <span class="nav-icon">◉</span>
                            <span class="nav-text">Profile</span>
                        </button>

                        <button class="nav-item" data-page="settings">
                            <span class="nav-icon">⚙</span>
                            <span class="nav-text">Settings</span>
                        </button>
                    </nav>

                    <div class="sidebar-footer">
                        <div class="user-mini">
                            <div class="avatar" id="sidebar-avatar">
                                ${this.escapeHTML(profile.display_name || profile.username).charAt(0).toUpperCase()}
                            </div>

                            <div class="user-mini-info">
                                <div class="user-mini-name" id="sidebar-name"></div>
                                <div class="user-mini-status">
                                    <span class="status-dot"></span>
                                    ONLINE
                                </div>
                            </div>
                        </div>

                        <button
                            class="btn btn-danger"
                            id="logout-button"
                            style="width:100%;margin-top:10px;"
                        >
                            LOG OUT
                        </button>
                    </div>
                </aside>

                <main class="main-content">
                    <header class="page-header">
                        <div>
                            <div class="page-title" id="page-title">MESSAGES</div>
                            <div class="page-subtitle">
                                PROJECT JUDAS / SECURE CONNECTION
                            </div>
                        </div>
                    </header>

                    <section id="page-content" style="
                        flex:1;
                        min-height:0;
                        overflow:auto;
                        display:flex;
                        flex-direction:column;
                    "></section>
                </main>
            </div>
        `;

        const avatar = document.getElementById("sidebar-avatar");

        if (profile.avatar_url) {
            const { data, error } = await supabaseClient
                .storage
                .from("avatars")
                .createSignedUrl(profile.avatar_url, 3600);

            if (!error && data) {
                const image = document.createElement("img");
                image.src = data.signedUrl;
                image.alt = "Profile picture";
                avatar.textContent = "";
                avatar.appendChild(image);
            }
        }

        document.getElementById("sidebar-name").textContent =
            profile.display_name || profile.username;

        document.getElementById("logout-button").addEventListener("click", async () => {
            const result = await JudasAuth.logout();

            if (!result.success) {
                this.notify(result.message);
            }
        });

        document.querySelectorAll(".nav-item").forEach(button => {
            button.addEventListener("click", async () => {
                document.querySelectorAll(".nav-item").forEach(item => {
                    item.classList.remove("active");
                });

                button.classList.add("active");

                const page = button.dataset.page;
                this.currentPage = page;

                const titles = {
                    messages: "MESSAGES",
                    groups: "GROUP CHATS",
                    users: "FIND USERS",
                    announcements: "ANNOUNCEMENTS",
                    profile: "PROFILE",
                    settings: "SETTINGS"
                };

                document.getElementById("page-title").textContent =
                    titles[page] || "PROJECT JUDAS";

                if (page !== "messages" && page !== "groups") {
                    await this.closeMessageSubscription();
                    this.currentConversation = null;
                }

                if (page === "messages") {
                    await this.showMessages();
                    return;
                }

                if (page === "groups") {
                    await this.showGroups();
                    return;
                }

                if (page === "users") {
                    this.showFindUsers();
                    return;
                }

                if (page === "profile") {
                    await this.showProfileSettings();
                    return;
                }

                if (page === "announcements") {
                    await this.showAnnouncements();
                    return;
                }

                document.getElementById("page-content").innerHTML = `
                    <div class="empty-state">
                        <h2>${this.escapeHTML(titles[page] || "PROJECT JUDAS")}</h2>
                        <p>This section is being built.</p>
                    </div>
                `;
            });
        });

        await this.startConversationSubscription();
        await this.showMessages();
    },

    async showMessages() {
        this.currentPage = "messages";
        await this.closeMessageSubscription();
        this.currentConversation = null;

        const content = document.getElementById("page-content");

        if (!content) return;

        content.innerHTML = `
            <div style="
                width:100%;
                max-width:900px;
                margin:0 auto;
                padding:25px;
            ">
                <div style="
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:15px;
                    margin-bottom:20px;
                ">
                    <div>
                        <h2 class="form-title">YOUR MESSAGES</h2>
                        <p class="form-description">
                            Your private conversations.
                        </p>
                    </div>

                    <button class="btn" id="refresh-conversations">
                        REFRESH
                    </button>
                </div>

                <div id="conversation-list">
                    <div class="empty-state">
                        <h2>LOADING MESSAGES</h2>
                        <p>Retrieving your conversations...</p>
                    </div>
                </div>
            </div>
        `;

        document.getElementById("refresh-conversations").addEventListener(
            "click",
            () => this.loadConversations()
        );

        await this.loadConversations();
    },

    async showGroups() {
        this.currentPage = "groups";
        await this.closeMessageSubscription();
        this.currentConversation = null;

        const content = document.getElementById("page-content");

        if (!content) return;

        content.innerHTML = `
            <div style="
                width:100%;
                max-width:900px;
                margin:0 auto;
                padding:25px;
            ">
                <div style="
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:15px;
                    margin-bottom:20px;
                ">
                    <div>
                        <h2 class="form-title">YOUR GROUP CHATS</h2>
                        <p class="form-description">
                            Group conversations across the network.
                        </p>
                    </div>

                    <button class="btn btn-primary" id="create-group-button">
                        CREATE GROUP
                    </button>
                </div>

                <div id="conversation-list">
                    <div class="empty-state">
                        <h2>LOADING GROUPS</h2>
                        <p>Retrieving your group conversations...</p>
                    </div>
                </div>
            </div>
        `;

        document.getElementById("create-group-button").addEventListener(
            "click",
            () => this.showCreateGroup()
        );

        await this.loadConversations();
    },

    async loadConversations(showLoading = true) {
        const container = document.getElementById("conversation-list");

        if (!container || !this.currentUser) return;

        if (showLoading) {
            container.innerHTML = `
                <div class="empty-state">
                    <h2>LOADING</h2>
                    <p>Retrieving your conversations...</p>
                </div>
            `;
        }

        try {
            const { data: memberships, error: membershipError } = await supabaseClient
                .from("conversation_members")
                .select("conversation_id, role")
                .eq("user_id", this.currentUser.id);

            if (membershipError) {
                throw membershipError;
            }

            if (!memberships || memberships.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <h2>NO CONVERSATIONS</h2>
                        <p>Visit Find Users or create a group to get started.</p>
                    </div>
                `;
                return;
            }

            const conversationIds = memberships.map(item => item.conversation_id);

            const { data: conversations, error: conversationError } = await supabaseClient
                .from("conversations")
                .select("id, type, name, created_at, created_by, avatar_path")
                .in("id", conversationIds)
                .order("created_at", { ascending: false });

            if (conversationError) {
                throw conversationError;
            }

            const { data: readStatuses, error: statusError } = await supabaseClient
                .from("conversation_read_status")
                .select("conversation_id, last_read_at, notification_dismissed_at")
                .eq("user_id", this.currentUser.id)
                .in("conversation_id", conversationIds);

            if (statusError) {
                throw statusError;
            }

            const conversationDetails = await Promise.all(
                conversations.map(async conversation => {
                    const { data: members, error: membersError } = await supabaseClient
                        .from("conversation_members")
                        .select("user_id, role")
                        .eq("conversation_id", conversation.id);

                    if (membersError) {
                        throw membersError;
                    }

                    const otherMembers = members.filter(
                        member => member.user_id !== this.currentUser.id
                    );

                    let otherProfile = null;
                    let memberProfiles = [];

                    if (otherMembers.length > 0) {
                        const { data: profiles, error: profileError } = await supabaseClient
                            .from("profiles")
                            .select("id, username, display_name, avatar_url")
                            .in("id", otherMembers.map(member => member.user_id));

                        if (profileError) {
                            throw profileError;
                        }

                        memberProfiles = profiles || [];

                        if (conversation.type !== "group") {
                            otherProfile = memberProfiles[0] || null;
                        }
                    }

                    const { data: latestMessage, error: messageError } = await supabaseClient
                        .from("messages")
                        .select("body, created_at, sender_id")
                        .eq("conversation_id", conversation.id)
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (messageError) {
                        throw messageError;
                    }

                    const status = readStatuses?.find(
                        item => item.conversation_id === conversation.id
                    );

                    let unreadCount = 0;

                    if (status?.notification_dismissed_at) {
                        const { count, error: unreadError } = await supabaseClient
                            .from("messages")
                            .select("id", { count: "exact", head: true })
                            .eq("conversation_id", conversation.id)
                            .neq("sender_id", this.currentUser.id)
                            .gt("created_at", status.notification_dismissed_at);

                        if (unreadError) {
                            throw unreadError;
                        }

                        unreadCount = count || 0;
                    }

                    const myMembership = members.find(
                        member => member.user_id === this.currentUser.id
                    );

                    return {
                        conversation,
                        otherProfile,
                        memberProfiles,
                        members,
                        latestMessage,
                        status,
                        unreadCount,
                        myRole: myMembership?.role || "member"
                    };
                })
            );

            const filteredDetails = conversationDetails.filter(item => {
                if (this.currentPage === "groups") {
                    return item.conversation.type === "group";
                }

                return item.conversation.type !== "group";
            });

            filteredDetails.sort((a, b) => {
                const aDate = a.latestMessage?.created_at || a.conversation.created_at;
                const bDate = b.latestMessage?.created_at || b.conversation.created_at;

                return new Date(bDate) - new Date(aDate);
            });

            container.innerHTML = "";

            for (const item of filteredDetails) {
                const card = document.createElement("button");
                card.type = "button";
                card.style.cssText = `
                    width:100%;
                    display:flex;
                    align-items:center;
                    gap:14px;
                    padding:14px;
                    margin-bottom:10px;
                    background:${item.unreadCount > 0 ? "var(--surface-light)" : "var(--surface)"};
                    border:1px solid ${item.unreadCount > 0 ? "var(--green)" : "var(--border)"};
                    color:var(--text);
                    text-align:left;
                    cursor:pointer;
                    font-family:inherit;
                `;

                const avatar = document.createElement("div");
                avatar.className = "avatar";
                avatar.style.cssText = `
                    width:48px;
                    height:48px;
                    min-width:48px;
                    font-size:16px;
                `;

                const isGroup = item.conversation.type === "group";

                const displayName = isGroup
                    ? item.conversation.name || "UNNAMED GROUP"
                    : item.otherProfile
                        ? item.otherProfile.display_name || item.otherProfile.username
                        : "UNKNOWN CONVERSATION";

                avatar.textContent = displayName.charAt(0).toUpperCase();

                if (isGroup && item.conversation.avatar_path) {
                    const { data: avatarData } = await supabaseClient.storage
                        .from("group-avatars")
                        .getPublicUrl(item.conversation.avatar_path);
                    if (avatarData?.publicUrl) {
                        const image = document.createElement("img");
                        image.src = avatarData.publicUrl;
                        image.alt = "Group picture";
                        avatar.textContent = "";
                        avatar.appendChild(image);
                    }
                }

                if (!isGroup && item.otherProfile?.avatar_url) {
                    const { data } = await supabaseClient
                        .storage
                        .from("avatars")
                        .createSignedUrl(item.otherProfile.avatar_url, 3600);

                    if (data) {
                        const image = document.createElement("img");
                        image.src = data.signedUrl;
                        image.alt = "Profile picture";
                        avatar.textContent = "";
                        avatar.appendChild(image);
                    }
                }

                const info = document.createElement("div");
                info.style.cssText = "flex:1;min-width:0;";

                const name = document.createElement("div");
                name.style.cssText = "font-size:12px;color:var(--text);";
                name.textContent = displayName;

                const username = document.createElement("div");
                username.style.cssText = "font-size:9px;color:var(--green);margin-top:4px;";
                username.textContent = isGroup
                    ? `${item.members.length} MEMBERS`
                    : "@" + (item.otherProfile?.username || "UNKNOWN");

                const preview = document.createElement("div");
                preview.style.cssText = `
                    font-size:10px;
                    color:var(--text-muted);
                    margin-top:7px;
                    overflow:hidden;
                    text-overflow:ellipsis;
                    white-space:nowrap;
                `;

                if (item.latestMessage) {
                    const prefix = item.latestMessage.sender_id === this.currentUser.id
                        ? "YOU: "
                        : "";

                    preview.textContent = prefix + item.latestMessage.body;
                } else {
                    preview.textContent = "No messages yet.";
                }

                info.append(name, username, preview);
                card.append(avatar, info);

                if (item.unreadCount > 0) {
                    const badge = document.createElement("div");
                    badge.textContent = item.unreadCount > 99 ? "99+" : item.unreadCount;
                    badge.style.cssText = `
                        min-width:23px;
                        height:23px;
                        padding:0 6px;
                        border-radius:20px;
                        background:var(--green);
                        color:#050805;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-size:10px;
                        font-weight:bold;
                    `;
                    card.appendChild(badge);
                }

                card.addEventListener("click", () => {
                    this.openConversation(item.conversation.id);
                });

                container.appendChild(card);
            }

            if (filteredDetails.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <h2>${this.currentPage === "groups" ? "NO GROUP CHATS" : "NO DIRECT MESSAGES"}</h2>
                        <p>${this.currentPage === "groups"
                            ? "Create a group to start talking with multiple users."
                            : "Visit Find Users and select someone to start a conversation."}</p>
                    </div>
                `;
            }

        } catch (error) {
            console.error("Conversation loading error:", error);

            container.innerHTML = `
                <div class="empty-state">
                    <h2>COULD NOT LOAD CONVERSATIONS</h2>
                    <p>${this.escapeHTML(error.message || "An unexpected error occurred.")}</p>
                    <button class="btn" id="retry-conversations">TRY AGAIN</button>
                </div>
            `;

            document.getElementById("retry-conversations")?.addEventListener(
                "click",
                () => this.loadConversations()
            );
        }
    },

    async showCreateGroup() {
        const content = document.getElementById("page-content");

        if (!content) return;

        content.innerHTML = `
            <div style="
                width:100%;
                max-width:700px;
                margin:0 auto;
                padding:25px;
            ">
                <button class="btn" id="cancel-create-group" style="margin-bottom:20px;">
                    &lt; BACK TO GROUPS
                </button>

                <h2 class="form-title">CREATE GROUP</h2>
                <p class="form-description">
                    Create a group conversation and invite users.
                </p>

                <form id="create-group-form">
                    <div class="form-group">
                        <label class="form-label">GROUP NAME</label>
                        <input
                            class="form-input"
                            id="group-name-input"
                            maxlength="50"
                            minlength="1"
                            placeholder="Enter a group name"
                            required
                        >
                    </div>

                    <div class="form-group">
                        <label class="form-label">GROUP PICTURE (OPTIONAL)</label>
                        <input class="form-input" id="group-avatar-input" type="file" accept="image/*">
                        <p class="form-description">You can also change this later in group management.</p>
                    </div>

                    <div class="form-group">
                        <label class="form-label">SEARCH USERS TO INVITE</label>
                        <input
                            class="form-input"
                            id="group-user-search"
                            type="search"
                            placeholder="Search by username or display name..."
                            autocomplete="off"
                        >
                    </div>

                    <div id="group-user-results" style="
                        display:flex;
                        flex-direction:column;
                        gap:8px;
                        margin-bottom:15px;
                    ">
                        <p class="form-description">Search for users to invite.</p>
                    </div>

                    <div class="form-group">
                        <label class="form-label">SELECTED MEMBERS</label>
                        <div id="selected-group-users" style="
                            color:var(--text-muted);
                            font-size:11px;
                            padding:12px;
                            background:var(--surface);
                            border:1px solid var(--border);
                        ">
                            No members selected.
                        </div>
                    </div>

                    <p id="create-group-error" style="
                        color:var(--danger);
                        font-size:11px;
                        margin-bottom:15px;
                    "></p>

                    <button class="btn btn-primary" type="submit" style="width:100%;">
                        CREATE GROUP
                    </button>
                </form>
            </div>
        `;

        document.getElementById("cancel-create-group").addEventListener(
            "click",
            () => this.showGroups()
        );

        const selectedUsers = new Map();
        const searchInput = document.getElementById("group-user-search");
        let searchTimeout = null;
        let searchVersion = 0;

        const renderSelected = () => {
            const container = document.getElementById("selected-group-users");

            if (selectedUsers.size === 0) {
                container.textContent = "No members selected.";
                return;
            }

            container.innerHTML = "";

            selectedUsers.forEach(user => {
                const row = document.createElement("div");
                row.style.cssText = `
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:10px;
                    margin-bottom:7px;
                `;

                const label = document.createElement("span");
                label.textContent = user.display_name || user.username;

                const remove = document.createElement("button");
                remove.className = "btn";
                remove.type = "button";
                remove.textContent = "REMOVE";
                remove.addEventListener("click", () => {
                    selectedUsers.delete(user.id);
                    renderSelected();
                });

                row.append(label, remove);
                container.appendChild(row);
            });
        };

        searchInput.addEventListener("input", () => {
            clearTimeout(searchTimeout);

            const query = searchInput.value.trim();
            searchVersion++;

            if (query.length < 2) {
                document.getElementById("group-user-results").innerHTML =
                    `<p class="form-description">Enter at least 2 characters to search.</p>`;
                return;
            }

            const version = searchVersion;

            searchTimeout = setTimeout(async () => {
                const safeQuery = query
                    .replace(/[%_\\]/g, character => "\\" + character)
                    .replace(/,/g, "");

                const { data, error } = await supabaseClient
                    .from("profiles")
                    .select("id, username, display_name")
                    .or(`username.ilike.%${safeQuery}%,display_name.ilike.%${safeQuery}%`)
                    .neq("id", this.currentUser.id)
                    .order("username", { ascending: true })
                    .limit(20);

                if (version !== searchVersion) return;

                const results = document.getElementById("group-user-results");

                if (error) {
                    results.textContent = "Could not search users.";
                    return;
                }

                results.innerHTML = "";

                const availableUsers = (data || []).filter(
                    user => !selectedUsers.has(user.id)
                );

                if (availableUsers.length === 0) {
                    results.innerHTML = `<p class="form-description">No available users found.</p>`;
                    return;
                }

                availableUsers.forEach(user => {
                    const row = document.createElement("div");
                    row.style.cssText = `
                        display:flex;
                        align-items:center;
                        justify-content:space-between;
                        gap:10px;
                        padding:10px;
                        background:var(--surface);
                        border:1px solid var(--border);
                    `;

                    const label = document.createElement("div");
                    label.style.cssText = "font-size:11px;";
                    label.textContent =
                        `${user.display_name || user.username} (@${user.username})`;

                    const add = document.createElement("button");
                    add.className = "btn";
                    add.type = "button";
                    add.textContent = "ADD";

                    add.addEventListener("click", () => {
                        selectedUsers.set(user.id, user);
                        renderSelected();
                        searchInput.dispatchEvent(new Event("input"));
                    });

                    row.append(label, add);
                    results.appendChild(row);
                });
            }, 300);
        });

        document.getElementById("create-group-form").addEventListener("submit", async event => {
            event.preventDefault();

            const name = document.getElementById("group-name-input").value.trim();
            const errorBox = document.getElementById("create-group-error");
            const button = event.currentTarget.querySelector("button[type='submit']");

            if (!name || name.length > 50) {
                errorBox.textContent = "Group names must be between 1 and 50 characters.";
                return;
            }

            if (selectedUsers.size === 0) {
                errorBox.textContent = "Select at least one person to invite.";
                return;
            }

            button.disabled = true;
            button.textContent = "CREATING GROUP...";

            try {
                const { data, error } = await supabaseClient.rpc(
                    "create_group_conversation",
                    {
                        group_name: name,
                        invited_users: Array.from(selectedUsers.keys())
                    }
                );

                if (error) throw error;

                if (!data) {
                    throw new Error("The group was created, but no conversation ID was returned.");
                }

                const avatarFile = document.getElementById("group-avatar-input")?.files?.[0];

                if (avatarFile) {
                    if (!avatarFile.type.startsWith("image/") || avatarFile.size > 10 * 1024 * 1024) {
                        this.notify("Group created, but the picture must be an image under 10 MB.");
                    } else {
                        const extension = (avatarFile.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
                        const avatarPath = `${data}/avatar.${extension}`;
                        const { error: uploadError } = await supabaseClient.storage
                            .from("group-avatars")
                            .upload(avatarPath, avatarFile, { upsert: true, contentType: avatarFile.type });

                        if (!uploadError) {
                            const { error: updateError } = await supabaseClient
                                .from("conversations")
                                .update({ avatar_path: avatarPath })
                                .eq("id", data);

                            if (updateError) this.notify("Group created, but its picture could not be saved.");
                        } else {
                            this.notify("Group created, but its picture could not be uploaded.");
                        }
                    }
                }

                this.notify("Group created successfully.");
                await this.openConversation(data);

            } catch (error) {
                console.error("Group creation error:", error);
                errorBox.textContent = error.message || "Could not create the group.";
                button.disabled = false;
                button.textContent = "CREATE GROUP";
            }
        });
    },

    async startDirectMessage(targetUserId) {
        if (!this.currentUser || !targetUserId) {
            this.notify("Could not start this conversation.");
            return;
        }

        if (targetUserId === this.currentUser.id) {
            this.notify("You cannot message yourself.");
            return;
        }

        const button = document.getElementById("start-direct-message");

        if (button) {
            button.disabled = true;
            button.textContent = "OPENING...";
        }

        try {
            const { data, error } = await supabaseClient.rpc(
                "create_direct_conversation",
                {
                    target_user_id: targetUserId
                }
            );

            if (error) {
                throw error;
            }

            if (!data) {
                throw new Error("The conversation could not be created.");
            }

            await this.openConversation(data);

        } catch (error) {
            console.error("Direct message creation error:", error);
            this.notify(error.message || "Could not start the conversation.");

            if (button) {
                button.disabled = false;
                button.textContent = "MESSAGE";
            }
        }
    },

    async openConversation(conversationId) {
        await this.closeMessageSubscription();

        this.currentConversation = conversationId;
        this.currentReadStatus = null;
        this.currentConversationData = null;
        this.currentConversationMembers = [];

        const content = document.getElementById("page-content");

        if (!content) return;

        content.innerHTML = `
            <div style="
                width:100%;
                max-width:1000px;
                margin:0 auto;
                padding:20px;
                display:flex;
                flex-direction:column;
                flex:1;
                min-height:0;
            ">
                <div style="
                    display:flex;
                    align-items:center;
                    gap:12px;
                    padding-bottom:15px;
                    border-bottom:1px solid var(--border);
                    margin-bottom:15px;
                ">
                    <button class="btn" id="back-to-messages">
                        &lt; BACK
                    </button>

                    <div style="min-width:0;flex:1;">
                        <div
                            id="conversation-title"
                            style="font-size:13px;color:var(--green);"
                        >
                            LOADING CONVERSATION...
                        </div>

                        <div
                            id="conversation-subtitle"
                            style="font-size:9px;color:var(--text-muted);margin-top:5px;"
                        ></div>
                    </div>

                    <button class="btn" id="group-manage-button" style="display:none;">
                        MANAGE
                    </button>

                    <button class="btn" id="refresh-messages">
                        REFRESH
                    </button>
                </div>

                <div
                    id="message-list"
                    style="
                        flex:1;
                        min-height:200px;
                        overflow-y:auto;
                        display:flex;
                        flex-direction:column;
                        gap:12px;
                        padding:10px 5px 20px;
                    "
                >
                    <div class="empty-state">
                        <h2>LOADING MESSAGES</h2>
                    </div>
                </div>

                <form
                    id="message-form"
                    style="
                        display:flex;
                        gap:10px;
                        align-items:flex-end;
                        border-top:1px solid var(--border);
                        padding-top:15px;
                    "
                >
                    <textarea
                        id="message-input"
                        class="form-textarea"
                        maxlength="5000"
                        rows="2"
                        placeholder="Write a message..."
                        style="flex:1;resize:vertical;min-height:55px;"
                        required
                    ></textarea>

                    <button
                        class="btn btn-primary"
                        id="send-message-button"
                        type="submit"
                        style="min-height:45px;"
                    >
                        SEND
                    </button>
                </form>
            </div>
        `;

        document.getElementById("back-to-messages").addEventListener(
            "click",
            () => {
                if (this.currentPage === "groups") {
                    this.showGroups();
                } else {
                    this.showMessages();
                }
            }
        );

        document.getElementById("refresh-messages").addEventListener(
            "click",
            () => this.loadMessages(conversationId, true)
        );

        document.getElementById("message-form").addEventListener(
            "submit",
            event => this.sendMessage(event, conversationId)
        );

        try {
            const { data: conversation, error: conversationError } = await supabaseClient
                .from("conversations")
                .select("id, type, name, created_by, avatar_path")
                .eq("id", conversationId)
                .single();

            if (conversationError) throw conversationError;

            this.currentConversationData = conversation;

            const { data: members, error: membersError } = await supabaseClient
                .from("conversation_members")
                .select("user_id, role")
                .eq("conversation_id", conversationId);

            if (membersError) throw membersError;

            this.currentConversationMembers = members || [];

            const otherMembers = members.filter(
                member => member.user_id !== this.currentUser.id
            );

            let profiles = [];

            if (otherMembers.length > 0) {
                const { data, error } = await supabaseClient
                    .from("profiles")
                    .select("id, username, display_name, avatar_url")
                    .in("id", otherMembers.map(member => member.user_id));

                if (error) throw error;
                profiles = data || [];
            }

            const title = document.getElementById("conversation-title");
            const subtitle = document.getElementById("conversation-subtitle");

            if (conversation.type === "group") {
                title.textContent = conversation.name || "GROUP CONVERSATION";
                subtitle.textContent = `${members.length} MEMBERS`;

                const manageButton = document.getElementById("group-manage-button");
                manageButton.style.display = "block";
                manageButton.addEventListener("click", () => this.showGroupManagement());
            } else {
                const otherProfile = profiles[0] || null;

                title.textContent = otherProfile
                    ? otherProfile.display_name || otherProfile.username
                    : "CONVERSATION";

                subtitle.textContent = otherProfile
                    ? "@" + otherProfile.username
                    : "PROJECT JUDAS";
            }

            const { data: readStatus, error: readError } = await supabaseClient
                .from("conversation_read_status")
                .select("last_read_at, notification_dismissed_at")
                .eq("conversation_id", conversationId)
                .eq("user_id", this.currentUser.id)
                .maybeSingle();

            if (readError) throw readError;

            this.currentReadStatus = readStatus;

            const { error: dismissError } = await supabaseClient.rpc(
                "dismiss_conversation_notification",
                {
                    target_conversation_id: conversationId
                }
            );

            if (dismissError) {
                console.error("Notification dismissal error:", dismissError);
            }

            await this.loadMessages(conversationId, true);
            this.subscribeToMessages(conversationId);
            this.loadConversations(false);

        } catch (error) {
            console.error("Opening conversation error:", error);
            this.notify("Could not open this conversation: " + error.message);
        }
    },

    async loadMessages(conversationId, initialLoad = false) {
        const container = document.getElementById("message-list");

        if (
            !container ||
            this.currentConversation !== conversationId ||
            this.loadingMessages
        ) return;

        this.loadingMessages = true;

        const wasAtBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight <= 40;

        const previousScrollTop = container.scrollTop;

        try {
            const { data, error } = await supabaseClient
                .from("messages")
                .select("id, conversation_id, sender_id, body, created_at")
                .eq("conversation_id", conversationId)
                .order("created_at", { ascending: true })
                .limit(200);

            if (error) throw error;

            if (this.currentConversation !== conversationId) return;

            const messages = data || [];
            const lastReadAt = this.currentReadStatus?.last_read_at;

            const firstUnreadIndex = lastReadAt
                ? messages.findIndex(message =>
                    message.sender_id !== this.currentUser.id &&
                    new Date(message.created_at) > new Date(lastReadAt)
                )
                : -1;

            container.innerHTML = "";

            if (messages.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="min-height:150px;">
                        <h2>NO MESSAGES YET</h2>
                        <p>Send the first message to begin this conversation.</p>
                    </div>
                `;
                this.loadingMessages = false;
                return;
            }

            messages.forEach((message, index) => {
                if (index === firstUnreadIndex) {
                    const divider = document.createElement("div");
                    divider.style.cssText = `
                        display:flex;
                        align-items:center;
                        gap:12px;
                        margin:12px 0;
                        color:var(--green);
                        font-size:9px;
                        letter-spacing:2px;
                    `;

                    const lineLeft = document.createElement("div");
                    const lineRight = document.createElement("div");

                    lineLeft.style.cssText = "height:1px;background:var(--green);flex:1;";
                    lineRight.style.cssText = "height:1px;background:var(--green);flex:1;";

                    const label = document.createElement("span");
                    label.textContent = "NEW MESSAGES";

                    divider.append(lineLeft, label, lineRight);
                    divider.id = "new-messages-divider";
                    container.appendChild(divider);
                }

                const ownMessage = message.sender_id === this.currentUser.id;

                const wrapper = document.createElement("div");
                wrapper.style.cssText = `
                    display:flex;
                    flex-direction:column;
                    align-items:${ownMessage ? "flex-end" : "flex-start"};
                    width:100%;
                `;

                const bubble = document.createElement("div");
                bubble.style.cssText = `
                    max-width:75%;
                    min-width:80px;
                    padding:11px 13px;
                    background:${ownMessage ? "var(--surface-light)" : "var(--surface)"};
                    border:1px solid ${ownMessage ? "var(--green)" : "var(--border)"};
                    color:var(--text);
                    font-size:11px;
                    line-height:1.6;
                    overflow-wrap:anywhere;
                    white-space:pre-wrap;
                `;
                bubble.textContent = message.body;

                const timestamp = document.createElement("div");
                timestamp.style.cssText = `
                    color:var(--text-dim);
                    font-size:8px;
                    margin-top:5px;
                `;

                timestamp.textContent =
                    (ownMessage ? "YOU · " : "THEM · ") +
                    new Date(message.created_at).toLocaleString();

                wrapper.append(bubble, timestamp);
                wrapper.dataset.messageId = message.id;
                container.appendChild(wrapper);
            });

            if (initialLoad) {
                const divider = document.getElementById("new-messages-divider");

                if (divider) {
                    divider.scrollIntoView({
                        block: "start",
                        behavior: "auto"
                    });
                } else {
                    container.scrollTop = container.scrollHeight;
                }
            } else if (wasAtBottom) {
                container.scrollTop = container.scrollHeight;
            } else {
                container.scrollTop = previousScrollTop;
            }

            this.loadingMessages = false;

            if (wasAtBottom && !initialLoad) {
                await this.markConversationRead(conversationId);
            }

        } catch (error) {
            this.loadingMessages = false;
            console.error("Message loading error:", error);

            container.innerHTML = `
                <div class="empty-state">
                    <h2>MESSAGE ERROR</h2>
                    <p>${this.escapeHTML(error.message || "Could not retrieve messages.")}</p>
                </div>
            `;
        }
    },

    async markConversationRead(conversationId) {
        if (
            this.markingRead ||
            this.currentConversation !== conversationId
        ) return;

        const container = document.getElementById("message-list");

        if (!container) return;

        const distanceFromBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight;

        if (distanceFromBottom > 40) return;

        this.markingRead = true;

        try {
            const { error } = await supabaseClient.rpc(
                "mark_conversation_read",
                {
                    target_conversation_id: conversationId
                }
            );

            if (error) throw error;

            this.currentReadStatus = {
                ...(this.currentReadStatus || {}),
                last_read_at: new Date().toISOString()
            };

            document.getElementById("new-messages-divider")?.remove();

            await this.loadConversations(false);

        } catch (error) {
            console.error("Marking conversation as read failed:", error);
        }

        this.markingRead = false;
    },

    async sendMessage(event, conversationId) {
        event.preventDefault();

        if (this.currentConversation !== conversationId) return;

        const input = document.getElementById("message-input");
        const button = document.getElementById("send-message-button");

        if (!input || !button) return;

        const body = input.value.trim();

        if (!body) return;

        if (body.length > 5000) {
            this.notify("Messages cannot exceed 5,000 characters.");
            return;
        }

        button.disabled = true;
        button.textContent = "SENDING...";

        try {
            const { error } = await supabaseClient
                .from("messages")
                .insert({
                    conversation_id: conversationId,
                    sender_id: this.currentUser.id,
                    body
                });

            if (error) throw error;

            input.value = "";
            await this.loadMessages(conversationId);

        } catch (error) {
            console.error("Message sending error:", error);
            this.notify("Message could not be sent: " + error.message);
        }

        button.disabled = false;
        button.textContent = "SEND";
        input.focus();
    },

    subscribeToMessages(conversationId) {
        this.messageChannel = supabaseClient
            .channel("messages-" + conversationId)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: "conversation_id=eq." + conversationId
                },
                () => {
                    if (this.currentConversation === conversationId) {
                        this.loadMessages(conversationId);
                    }
                }
            )
            .subscribe(status => {
                if (status === "CHANNEL_ERROR") {
                    console.error("Message realtime connection failed.");
                }
            });

        const container = document.getElementById("message-list");

        if (container) {
            container.addEventListener("scroll", () => {
                this.markConversationRead(conversationId);
            });
        }
    },

    async showGroupManagement() {
        const conversation = this.currentConversationData;

        if (!conversation || conversation.type !== "group") return;

        const isLeader = this.currentConversationMembers.some(
            member =>
                member.user_id === this.currentUser.id &&
                member.role === "leader"
        );

        const content = document.getElementById("page-content");

        if (!content) return;

        const { data: profiles, error } = await supabaseClient
            .from("profiles")
            .select("id, username, display_name")
            .in(
                "id",
                this.currentConversationMembers.map(member => member.user_id)
            );

        if (error) {
            this.notify("Could not load group members.");
            return;
        }

        const profileMap = new Map(
            (profiles || []).map(profile => [profile.id, profile])
        );

        content.innerHTML = `
            <div style="
                width:100%;
                max-width:800px;
                margin:0 auto;
                padding:25px;
            ">
                <button class="btn" id="back-to-group-chat" style="margin-bottom:20px;">
                    &lt; BACK TO CHAT
                </button>

                <h2 class="form-title">GROUP MANAGEMENT</h2>
                <p class="form-description">
                    ${this.escapeHTML(conversation.name || "GROUP CONVERSATION")}
                </p>

                ${isLeader ? `
                    <div style="margin:20px 0;padding:15px;background:var(--surface);border:1px solid var(--border);">
                        <h3 class="form-title">GROUP PICTURE</h3>
                        <form id="group-avatar-form" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;">
                            <input class="form-input" id="group-avatar-file" type="file" accept="image/*" required>
                            <button class="btn btn-primary" type="submit">UPLOAD PICTURE</button>
                        </form>
                        <h3 class="form-title">RENAME GROUP</h3>
                        <form id="rename-group-form" style="display:flex;gap:10px;">
                            <input
                                class="form-input"
                                id="rename-group-input"
                                maxlength="50"
                                value="${this.escapeHTML(conversation.name || "")}"
                                required
                            >
                            <button class="btn btn-primary" type="submit">SAVE</button>
                        </form>
                    </div>

                    <div style="margin:20px 0;padding:15px;background:var(--surface);border:1px solid var(--border);">
                        <h3 class="form-title">INVITE MEMBERS</h3>
                        <input
                            class="form-input"
                            id="invite-search"
                            type="search"
                            placeholder="Search users to invite..."
                        >
                        <div id="invite-results" style="margin-top:10px;"></div>
                    </div>
                ` : ""}

                <div style="margin-top:20px;">
                    <h3 class="form-title">MEMBERS (${this.currentConversationMembers.length})</h3>
                    <div id="group-member-list" style="display:flex;flex-direction:column;gap:8px;"></div>
                </div>

                ${isLeader ? `
                    <div style="margin-top:25px;padding:15px;background:var(--surface);border:1px solid var(--border);">
                        <h3 class="form-title">TRANSFER OWNERSHIP</h3>
                        <p class="form-description">
                            Transfer leadership to another group member.
                        </p>
                        <select class="form-input" id="transfer-leader-select">
                            <option value="">Select a member...</option>
                            ${this.currentConversationMembers
                                .filter(member => member.user_id !== this.currentUser.id)
                                .map(member => {
                                    const profile = profileMap.get(member.user_id);
                                    return `
                                        <option value="${member.user_id}">
                                            ${this.escapeHTML(profile?.display_name || profile?.username || "Unknown user")}
                                        </option>
                                    `;
                                }).join("")}
                        </select>
                        <button class="btn" id="transfer-leader-button" style="margin-top:10px;">
                            TRANSFER OWNERSHIP
                        </button>
                    </div>
                ` : ""}

                <div style="margin-top:25px;">
                    <button class="btn btn-danger" id="leave-group-button">
                        LEAVE GROUP
                    </button>
                </div>
            </div>
        `;

        document.getElementById("back-to-group-chat").addEventListener(
            "click",
            () => this.openConversation(conversation.id)
        );

        const memberList = document.getElementById("group-member-list");

        this.currentConversationMembers.forEach(member => {
            const profile = profileMap.get(member.user_id);
            const row = document.createElement("div");

            row.style.cssText = `
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:10px;
                padding:12px;
                background:var(--surface);
                border:1px solid var(--border);
            `;

            const label = document.createElement("div");
            label.style.cssText = "font-size:11px;";
            label.textContent =
                `${profile?.display_name || profile?.username || "Unknown user"}${member.user_id === this.currentUser.id ? " (YOU)" : ""}`;

            const role = document.createElement("span");
            role.style.cssText = "color:var(--green);font-size:9px;";
            role.textContent = member.role === "leader" ? "LEADER" : "MEMBER";

            row.append(label, role);

            if (isLeader && member.user_id !== this.currentUser.id) {
                const remove = document.createElement("button");
                remove.className = "btn btn-danger";
                remove.type = "button";
                remove.textContent = "REMOVE";

                remove.addEventListener("click", async () => {
                    if (!confirm(`Remove ${profile?.display_name || profile?.username || "this member"} from the group?`)) {
                        return;
                    }

                    const { error } = await supabaseClient.rpc(
                        "manage_group_member",
                        {
                            target_conversation_id: conversation.id,
                            target_user_id: member.user_id,
                            action: "remove"
                        }
                    );

                    if (error) {
                        this.notify(error.message);
                        return;
                    }

                    this.notify("Member removed.");
                    await this.showGroupManagement();
                });

                row.appendChild(remove);
            }

            memberList.appendChild(row);
        });

        if (isLeader) {
            document.getElementById("group-avatar-form").addEventListener("submit", async event => {
                event.preventDefault();
                const file = document.getElementById("group-avatar-file").files[0];
                if (!file || !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
                    this.notify("Choose an image under 10 MB.");
                    return;
                }
                const extension = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
                const path = `${conversation.id}/avatar.${extension}`;
                const button = event.currentTarget.querySelector("button[type='submit']");
                button.disabled = true;
                button.textContent = "UPLOADING...";
                const { error: uploadError } = await supabaseClient.storage
                    .from("group-avatars")
                    .upload(path, file, { upsert: true, contentType: file.type });
                if (uploadError) {
                    this.notify(uploadError.message || "Could not upload group picture.");
                    button.disabled = false;
                    button.textContent = "UPLOAD PICTURE";
                    return;
                }
                const { error: updateError } = await supabaseClient
                    .from("conversations")
                    .update({ avatar_path: path })
                    .eq("id", conversation.id);
                if (updateError) {
                    this.notify(updateError.message || "Could not save group picture.");
                } else {
                    conversation.avatar_path = path;
                    this.currentConversationData = conversation;
                    this.notify("Group picture updated.");
                    await this.openConversation(conversation.id);
                    await this.showGroupManagement();
                }
                button.disabled = false;
                button.textContent = "UPLOAD PICTURE";
            });

            document.getElementById("rename-group-form").addEventListener("submit", async event => {
                event.preventDefault();

                const newName = document.getElementById("rename-group-input").value.trim();

                if (!newName || newName.length > 50) {
                    this.notify("Group names must be between 1 and 50 characters.");
                    return;
                }

                const { error } = await supabaseClient.rpc(
                    "rename_group_conversation",
                    {
                        target_conversation_id: conversation.id,
                        new_group_name: newName
                    }
                );

                if (error) {
                    this.notify(error.message);
                    return;
                }

                this.currentConversationData.name = newName;
                this.notify("Group renamed.");
                await this.openConversation(conversation.id);
            });

            const inviteInput = document.getElementById("invite-search");
            let inviteTimeout = null;
            let inviteVersion = 0;

            inviteInput.addEventListener("input", () => {
                clearTimeout(inviteTimeout);

                const query = inviteInput.value.trim();
                inviteVersion++;

                if (query.length < 2) {
                    document.getElementById("invite-results").innerHTML = "";
                    return;
                }

                const version = inviteVersion;

                inviteTimeout = setTimeout(async () => {
                    const safeQuery = query
                        .replace(/[%_\\]/g, character => "\\" + character)
                        .replace(/,/g, "");

                    const { data, error } = await supabaseClient
                        .from("profiles")
                        .select("id, username, display_name")
                        .or(`username.ilike.%${safeQuery}%,display_name.ilike.%${safeQuery}%`)
                        .neq("id", this.currentUser.id)
                        .limit(20);

                    if (version !== inviteVersion) return;

                    const results = document.getElementById("invite-results");
                    results.innerHTML = "";

                    if (error) {
                        results.textContent = "Could not search users.";
                        return;
                    }

                    const existingIds = this.currentConversationMembers.map(
                        member => member.user_id
                    );

                    const available = (data || []).filter(
                        user => !existingIds.includes(user.id)
                    );

                    if (available.length === 0) {
                        results.textContent = "No available users found.";
                        return;
                    }

                    available.forEach(user => {
                        const row = document.createElement("div");
                        row.style.cssText = `
                            display:flex;
                            align-items:center;
                            justify-content:space-between;
                            gap:10px;
                            padding:10px;
                            margin-top:7px;
                            background:var(--surface);
                            border:1px solid var(--border);
                        `;

                        const label = document.createElement("span");
                        label.style.fontSize = "10px";
                        label.textContent =
                            `${user.display_name || user.username} (@${user.username})`;

                        const add = document.createElement("button");
                        add.className = "btn";
                        add.type = "button";
                        add.textContent = "INVITE";

                        add.addEventListener("click", async () => {
                            add.disabled = true;
                            add.textContent = "INVITING...";

                            const { error: inviteError } = await supabaseClient.rpc(
                                "invite_group_members",
                                {
                                    target_conversation_id: conversation.id,
                                    invited_users: [user.id]
                                }
                            );

                            if (inviteError) {
                                this.notify(inviteError.message);
                                add.disabled = false;
                                add.textContent = "INVITE";
                                return;
                            }

                            this.notify("Member invited.");
                            await this.openConversation(conversation.id);
                            await this.showGroupManagement();
                        });

                        row.append(label, add);
                        results.appendChild(row);
                    });
                }, 300);
            });

            document.getElementById("transfer-leader-button").addEventListener("click", async () => {
                const newLeaderId = document.getElementById("transfer-leader-select").value;

                if (!newLeaderId) {
                    this.notify("Select a group member first.");
                    return;
                }

                if (!confirm("Transfer group ownership to this member? You will become a regular member.")) {
                    return;
                }

                const { error } = await supabaseClient.rpc(
                    "transfer_group_ownership",
                    {
                        target_conversation_id: conversation.id,
                        new_leader_id: newLeaderId
                    }
                );

                if (error) {
                    this.notify(error.message);
                    return;
                }

                this.notify("Group ownership transferred.");
                await this.openConversation(conversation.id);
            });
        }

        document.getElementById("leave-group-button").addEventListener("click", async () => {
            if (isLeader) {
                this.notify("Transfer ownership before leaving the group.");
                return;
            }

            if (!confirm("Are you sure you want to leave this group?")) return;

            const { error } = await supabaseClient.rpc(
                "manage_group_member",
                {
                    target_conversation_id: conversation.id,
                    target_user_id: this.currentUser.id,
                    action: "leave"
                }
            );

            if (error) {
                this.notify(error.message);
                return;
            }

            this.notify("You left the group.");
            this.currentConversation = null;
            await this.showGroups();
        });
    },

    showFindUsers() {
        const content = document.getElementById("page-content");

        if (!content) return;

        content.innerHTML = `
            <div style="
                width:100%;
                max-width:850px;
                margin:0 auto;
                padding:25px;
            ">
                <div style="margin-bottom:25px;">
                    <h2 class="form-title">FIND USERS</h2>

                    <p class="form-description" style="margin-bottom:15px;">
                        Search the Project Judas network for other users.
                    </p>

                    <input
                        type="search"
                        class="chat-search"
                        id="user-search"
                        placeholder="Search by username or display name..."
                        autocomplete="off"
                        maxlength="40"
                    >

                    <p style="
                        color:var(--text-dim);
                        font-size:9px;
                        margin-top:8px;
                    ">
                        ENTER A USERNAME OR DISPLAY NAME TO BEGIN SEARCHING.
                    </p>
                </div>

                <div
                    id="user-search-status"
                    style="
                        color:var(--text-muted);
                        font-size:10px;
                        margin-bottom:15px;
                    "
                >
                    READY TO SEARCH.
                </div>

                <div
                    id="user-search-results"
                    style="
                        display:flex;
                        flex-direction:column;
                        gap:10px;
                    "
                >
                    <div class="empty-state" style="min-height:180px;">
                        <h2>USER DIRECTORY</h2>
                        <p>Search for someone to see their profile.</p>
                    </div>
                </div>
            </div>
        `;

        const searchInput = document.getElementById("user-search");

        let searchTimeout = null;
        let searchVersion = 0;

        searchInput.addEventListener("input", () => {
            clearTimeout(searchTimeout);

            const query = searchInput.value.trim();
            searchVersion++;

            if (!query) {
                this.renderUserSearchMessage(
                    "USER DIRECTORY",
                    "Search for someone to see their profile."
                );

                document.getElementById("user-search-status").textContent =
                    "READY TO SEARCH.";

                return;
            }

            if (query.length < 2) {
                this.renderUserSearchMessage(
                    "KEEP TYPING",
                    "Enter at least 2 characters to search."
                );

                document.getElementById("user-search-status").textContent =
                    "SEARCH REQUIRES 2 CHARACTERS.";

                return;
            }

            const currentVersion = searchVersion;

            document.getElementById("user-search-status").textContent =
                "SEARCHING NETWORK...";

            this.renderUserSearchMessage(
                "SEARCHING",
                "Looking for matching users..."
            );

            searchTimeout = setTimeout(async () => {
                await this.searchUsers(
                    query,
                    currentVersion,
                    () => searchVersion
                );
            }, 350);
        });

        searchInput.focus();
    },

    async searchUsers(query, version, getCurrentVersion) {
        const resultsContainer = document.getElementById("user-search-results");
        const status = document.getElementById("user-search-status");

        if (!resultsContainer || !status) return;

        const safeQuery = query
            .replace(/[%_\\]/g, character => "\\" + character)
            .replace(/,/g, "");

        try {
            const { data, error } = await supabaseClient
                .from("profiles")
                .select("id, username, display_name, bio, pronouns, avatar_url, banner_url, status_text, status_emoji, presence_status, profile_color")
                .or(
                    `username.ilike.%${safeQuery}%,display_name.ilike.%${safeQuery}%`
                )
                .neq("id", this.currentUser.id)
                .order("username", { ascending: true })
                .limit(25);

            if (version !== getCurrentVersion()) return;

            if (error) throw error;

            if (!data || data.length === 0) {
                status.textContent = "SEARCH COMPLETE. 0 RESULTS.";

                this.renderUserSearchMessage(
                    "NO USERS FOUND",
                    "Try another username or display name."
                );

                return;
            }

            status.textContent =
                `SEARCH COMPLETE. ${data.length} USER${data.length === 1 ? "" : "S"} FOUND.`;

            await this.renderUserResults(data, version, getCurrentVersion);

        } catch (error) {
            console.error("User search error:", error);

            if (version !== getCurrentVersion()) return;

            status.textContent = "SEARCH FAILED.";

            this.renderUserSearchMessage(
                "CONNECTION ERROR",
                "Could not search the user directory. Please try again."
            );
        }
    },

    async renderUserResults(users, version, getCurrentVersion) {
        const container = document.getElementById("user-search-results");

        if (!container) return;

        container.innerHTML = "";

        for (const user of users) {
            let avatarUrl = null;

            if (user.avatar_url) {
                const { data, error } = await supabaseClient
                    .storage
                    .from("avatars")
                    .createSignedUrl(user.avatar_url, 3600);

                if (!error && data) {
                    avatarUrl = data.signedUrl;
                }
            }

            if (version !== getCurrentVersion()) return;

            const card = document.createElement("div");

            card.style.cssText = `
                display:flex;
                align-items:center;
                gap:15px;
                padding:15px;
                background:var(--surface);
                border:1px solid var(--border);
                min-width:0;
            `;

            const avatar = document.createElement("div");
            avatar.className = "avatar";
            avatar.style.cssText = `
                width:52px;
                height:52px;
                min-width:52px;
                font-size:18px;
            `;

            if (avatarUrl) {
                const image = document.createElement("img");
                image.src = avatarUrl;
                image.alt = "Profile picture";
                avatar.appendChild(image);
            } else {
                avatar.textContent = (
                    user.display_name || user.username || "?"
                ).charAt(0).toUpperCase();
            }

            const info = document.createElement("div");
            info.style.cssText = "flex:1;min-width:0;";

            const displayName = document.createElement("div");
            displayName.style.cssText = `
                color:var(--text);
                font-size:12px;
                overflow-wrap:anywhere;
            `;
            displayName.textContent = user.display_name || user.username;

            const username = document.createElement("div");
            username.style.cssText = `
                color:var(--green);
                font-size:10px;
                margin-top:4px;
                overflow-wrap:anywhere;
            `;
            username.textContent = "@" + user.username;

            const bio = document.createElement("div");
            bio.style.cssText = `
                color:var(--text-muted);
                font-size:9px;
                margin-top:7px;
                overflow-wrap:anywhere;
            `;
            bio.textContent = user.bio || "No bio provided.";

            const pronouns = document.createElement("div");
            pronouns.style.cssText = `
                color:var(--text-dim);
                font-size:9px;
                margin-top:5px;
            `;
            pronouns.textContent = user.pronouns || "";

            info.append(displayName, username, bio);

            if (user.pronouns) {
                info.appendChild(pronouns);
            }

            const viewButton = document.createElement("button");
            viewButton.className = "btn";
            viewButton.textContent = "VIEW";
            viewButton.type = "button";

            viewButton.addEventListener("click", () => {
                this.showPublicProfile(user);
            });

            card.append(avatar, info, viewButton);
            container.appendChild(card);
        }
    },

    renderUserSearchMessage(title, message) {
        const container = document.getElementById("user-search-results");

        if (!container) return;

        container.innerHTML = `
            <div class="empty-state" style="min-height:180px;">
                <h2>${this.escapeHTML(title)}</h2>
                <p>${this.escapeHTML(message)}</p>
            </div>
        `;
    },

    async showPublicProfile(user) {
        const content = document.getElementById("page-content");

        if (!content) return;

        content.innerHTML = `
            <div style="
                width:100%;
                max-width:700px;
                margin:30px auto;
                padding:20px;
            ">
                <button
                    class="btn"
                    id="back-to-user-search"
                    style="margin-bottom:20px;"
                >
                    &lt; BACK TO SEARCH
                </button>

                <div class="profile-container" style="margin:0;">
                    <div class="profile-header">
                        <div class="profile-avatar" id="public-profile-avatar">
                            ${this.escapeHTML(
                                (user.display_name || user.username || "?")
                                    .charAt(0)
                                    .toUpperCase()
                            )}
                        </div>

                        <div style="min-width:0;">
                            <div class="profile-display-name">
                                ${this.escapeHTML(user.display_name || user.username)}
                            </div>

                            <div class="profile-username">
                                @${this.escapeHTML(user.username)}
                            </div>

                            <div
                                id="public-profile-pronouns"
                                style="
                                    color:var(--text-muted);
                                    font-size:10px;
                                    margin-top:7px;
                                "
                            >
                                ${this.escapeHTML(user.pronouns || "")}
                            </div>
                        </div>
                    </div>

                    <div style="margin:12px 0;padding:10px;background:${/^#[0-9a-f]{6}$/i.test(user.profile_color || "") ? user.profile_color : "var(--surface)"};">
                        <div style="font-size:11px;">${this.escapeHTML(user.status_emoji || "")} ${this.escapeHTML(user.status_text || "")}</div>
                        <div style="font-size:9px;color:var(--text-muted);margin-top:5px;">${this.escapeHTML((user.presence_status || "online").toUpperCase())}</div>
                    </div>
                    <div>
                        <div class="form-label">ABOUT</div>
                        <div class="profile-bio">
                            ${this.escapeHTML(user.bio || "This user has not written a bio.")}
                        </div>
                    </div>

                    <div style="
                        border-top:1px solid var(--border);
                        margin-top:25px;
                        padding-top:20px;
                        display:flex;
                        flex-wrap:wrap;
                        gap:10px;
                    ">
                        <button
                            class="btn btn-primary"
                            id="start-direct-message"
                            type="button"
                        >
                            MESSAGE
                        </button>

                        <p style="
                            width:100%;
                            color:var(--text-dim);
                            font-size:9px;
                            margin-top:5px;
                        ">
                            PROJECT JUDAS USER DIRECTORY
                        </p>
                    </div>
                </div>
            </div>
        `;

        document.getElementById("back-to-user-search").addEventListener(
            "click",
            () => this.showFindUsers()
        );

        document.getElementById("start-direct-message").addEventListener(
            "click",
            () => this.startDirectMessage(user.id)
        );

        if (user.banner_url) {
            const { data: bannerData } = await supabaseClient.storage
                .from("profile-banners")
                .createSignedUrl(user.banner_url, 3600);
            if (bannerData?.signedUrl) {
                const banner = document.createElement("div");
                banner.style.cssText = `height:120px;margin-bottom:15px;background-image:url("${bannerData.signedUrl}");background-size:cover;background-position:center;border:1px solid var(--border);`;
                const profileContainer = content.querySelector(".profile-container");
                profileContainer?.prepend(banner);
            }
        }

        if (user.avatar_url) {
            const { data, error } = await supabaseClient
                .storage
                .from("avatars")
                .createSignedUrl(user.avatar_url, 3600);

            if (!error && data) {
                const avatar = document.getElementById("public-profile-avatar");

                if (avatar) {
                    const image = document.createElement("img");
                    image.src = data.signedUrl;
                    image.alt = "Profile picture";

                    avatar.textContent = "";
                    avatar.appendChild(image);
                }
            }
        }
    },


    async showProfileSettings() {
        const content = document.getElementById("page-content");
        if (!content || !this.currentUser) return;

        const { data: profile, error } = await supabaseClient
            .from("profiles")
            .select("id, username, display_name, bio, pronouns, avatar_url, banner_url, status_text, status_emoji, presence_status, profile_color")
            .eq("id", this.currentUser.id)
            .single();

        if (error) {
            this.notify("Could not load your profile settings.");
            return;
        }

        this.currentProfile = profile;
        content.innerHTML = `
            <div style="width:100%;max-width:760px;margin:0 auto;padding:25px;">
                <h2 class="form-title">PROFILE CUSTOMIZATION</h2>
                <p class="form-description">Update how other users see you across Project Judas.</p>
                <form id="profile-settings-form">
                    <div class="form-group">
                        <label class="form-label">DISPLAY NAME</label>
                        <input class="form-input" id="profile-display-name" maxlength="40" value="${this.escapeHTML(profile.display_name || "")}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">BIO</label>
                        <textarea class="form-textarea" id="profile-bio" maxlength="500" rows="4">${this.escapeHTML(profile.bio || "")}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">PRONOUNS</label>
                        <input class="form-input" id="profile-pronouns" maxlength="40" value="${this.escapeHTML(profile.pronouns || "")}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">STATUS EMOJI</label>
                        <input class="form-input" id="profile-status-emoji" maxlength="16" value="${this.escapeHTML(profile.status_emoji || "")}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">STATUS MESSAGE</label>
                        <input class="form-input" id="profile-status-text" maxlength="128" value="${this.escapeHTML(profile.status_text || "")}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">PRESENCE</label>
                        <select class="form-input" id="profile-presence">
                            ${["online","idle","dnd","invisible"].map(value => `<option value="${value}" ${profile.presence_status === value ? "selected" : ""}>${value.toUpperCase()}</option>`).join("")}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">PROFILE COLOR</label>
                        <input id="profile-color" type="color" value="${/^#[0-9a-f]{6}$/i.test(profile.profile_color || "") ? profile.profile_color : "#202225"}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">PROFILE PICTURE</label>
                        <input class="form-input" id="profile-avatar-file" type="file" accept="image/*">
                    </div>
                    <div class="form-group">
                        <label class="form-label">PROFILE BANNER</label>
                        <input class="form-input" id="profile-banner-file" type="file" accept="image/*">
                    </div>
                    <p id="profile-settings-error" style="color:var(--danger);font-size:11px;"></p>
                    <button class="btn btn-primary" type="submit">SAVE PROFILE</button>
                </form>
            </div>
        `;

        document.getElementById("profile-settings-form").addEventListener("submit", async event => {
            event.preventDefault();
            const button = event.currentTarget.querySelector("button[type='submit']");
            const errorBox = document.getElementById("profile-settings-error");
            const avatarFile = document.getElementById("profile-avatar-file").files[0];
            const bannerFile = document.getElementById("profile-banner-file").files[0];
            const validImage = file => !file || (file.type.startsWith("image/") && file.size <= 10 * 1024 * 1024);

            if (!validImage(avatarFile) || !validImage(bannerFile)) {
                errorBox.textContent = "Images must be under 10 MB.";
                return;
            }

            button.disabled = true;
            button.textContent = "SAVING...";
            try {
                const updates = {
                    display_name: document.getElementById("profile-display-name").value.trim(),
                    bio: document.getElementById("profile-bio").value,
                    pronouns: document.getElementById("profile-pronouns").value.trim(),
                    status_emoji: document.getElementById("profile-status-emoji").value.trim(),
                    status_text: document.getElementById("profile-status-text").value.trim(),
                    presence_status: document.getElementById("profile-presence").value,
                    profile_color: document.getElementById("profile-color").value
                };

                for (const [file, bucket, column, prefix] of [
                    [avatarFile, "avatars", "avatar_url", "avatar"],
                    [bannerFile, "profile-banners", "banner_url", "banner"]
                ]) {
                    if (!file) continue;
                    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
                    const storagePath = `${this.currentUser.id}/${prefix}.${ext}`;
                    const { error: uploadError } = await supabaseClient.storage
                        .from(bucket)
                        .upload(storagePath, file, { upsert: true, contentType: file.type });
                    if (uploadError) throw uploadError;
                    updates[column] = storagePath;
                }

                const { data, error: updateError } = await supabaseClient
                    .from("profiles")
                    .update(updates)
                    .eq("id", this.currentUser.id)
                    .select()
                    .single();
                if (updateError) throw updateError;
                this.currentProfile = data;
                this.notify("Profile updated.");
                await this.showProfileSettings();
            } catch (error) {
                console.error("Profile update error:", error);
                errorBox.textContent = error.message || "Could not save your profile.";
            } finally {
                button.disabled = false;
                button.textContent = "SAVE PROFILE";
            }
        });
    },

    async showAnnouncements() {
        const content = document.getElementById("page-content");
        if (!content) return;
        const creatorId = "7dbba6f4-585e-4df1-bb91-7246bb49bd34";
        const canPost = this.currentUser?.id === creatorId;

        content.innerHTML = `
            <div style="width:100%;max-width:850px;margin:0 auto;padding:25px;">
                <h2 class="form-title">ANNOUNCEMENTS</h2>
                <p class="form-description">Official Project Judas updates and notices.</p>
                ${canPost ? `
                    <form id="announcement-form" style="margin:20px 0;padding:16px;background:var(--surface);border:1px solid var(--border);">
                        <label class="form-label">NEW ANNOUNCEMENT</label>
                        <textarea class="form-textarea" id="announcement-content" rows="4" maxlength="10000" required placeholder="Write an announcement..."></textarea>
                        <div class="form-group" style="margin-top:10px;">
                            <label class="form-label">ATTACHMENTS</label>
                            <input class="form-input" id="announcement-files" type="file" multiple>
                        </div>
                        <button class="btn btn-primary" type="submit">PUBLISH</button>
                        <p id="announcement-error" style="color:var(--danger);font-size:11px;"></p>
                    </form>
                ` : ""}
                <div id="announcement-list"><div class="empty-state"><h2>LOADING</h2></div></div>
            </div>
        `;

        if (canPost) {
            document.getElementById("announcement-form").addEventListener("submit", async event => {
                event.preventDefault();
                const form = event.currentTarget;
                const button = form.querySelector("button[type='submit']");
                const errorBox = document.getElementById("announcement-error");
                const body = document.getElementById("announcement-content").value.trim();
                const files = Array.from(document.getElementById("announcement-files").files || []);
                if (!body) {
                    errorBox.textContent = "Write something before publishing.";
                    return;
                }
                if (files.some(file => file.size > 25 * 1024 * 1024)) {
                    errorBox.textContent = "Each attachment must be under 25 MB.";
                    return;
                }
                button.disabled = true;
                button.textContent = "PUBLISHING...";
                try {
                    const { data: announcement, error } = await supabaseClient
                        .from("announcements")
                        .insert({ author_id: this.currentUser.id, content: body })
                        .select()
                        .single();
                    if (error) throw error;

                    for (const file of files) {
                        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "attachment";
                        const path = `${announcement.id}/${Date.now()}_${safeName}`;
                        const { error: uploadError } = await supabaseClient.storage
                            .from("announcements")
                            .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
                        if (uploadError) throw uploadError;
                        const { error: metadataError } = await supabaseClient
                            .from("announcement_attachments")
                            .insert({
                                announcement_id: announcement.id,
                                file_name: file.name,
                                file_path: path,
                                file_type: file.type || "application/octet-stream",
                                file_size: file.size
                            });
                        if (metadataError) throw metadataError;
                    }
                    this.notify("Announcement published.");
                    await this.showAnnouncements();
                } catch (error) {
                    console.error("Announcement publish error:", error);
                    errorBox.textContent = error.message || "Could not publish the announcement.";
                } finally {
                    button.disabled = false;
                    button.textContent = "PUBLISH";
                }
            });
        }

        const { data: announcements, error } = await supabaseClient
            .from("announcements")
            .select("id, author_id, content, created_at, updated_at")
            .order("created_at", { ascending: false })
            .limit(100);
        const list = document.getElementById("announcement-list");
        if (!list) return;
        if (error) {
            list.textContent = "Could not load announcements.";
            return;
        }
        if (!announcements?.length) {
            list.innerHTML = `<div class="empty-state"><h2>NO ANNOUNCEMENTS</h2><p>There are no announcements yet.</p></div>`;
            return;
        }

        list.innerHTML = "";
        for (const announcement of announcements) {
            const card = document.createElement("article");
            card.style.cssText = "padding:18px;margin:15px 0;background:var(--surface);border:1px solid var(--border);";
            const date = document.createElement("div");
            date.style.cssText = "font-size:10px;color:var(--text-muted);margin-bottom:10px;";
            date.textContent = new Date(announcement.created_at).toLocaleString();
            const body = document.createElement("div");
            body.style.cssText = "font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;";
            body.textContent = announcement.content;
            card.append(date, body);

            const { data: attachments } = await supabaseClient
                .from("announcement_attachments")
                .select("id, file_name, file_path, file_type, file_size")
                .eq("announcement_id", announcement.id);
            if (attachments?.length) {
                const attachmentArea = document.createElement("div");
                attachmentArea.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-top:14px;";
                for (const attachment of attachments) {
                    const { data: signed } = await supabaseClient.storage
                        .from("announcements")
                        .createSignedUrl(attachment.file_path, 3600);
                    if (!signed?.signedUrl) continue;
                    const link = document.createElement("a");
                    link.href = signed.signedUrl;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    link.textContent = `${attachment.file_name} (${Math.ceil(attachment.file_size / 1024)} KB)`;
                    link.style.cssText = "color:var(--green);font-size:11px;";
                    attachmentArea.appendChild(link);
                }
                card.appendChild(attachmentArea);
            }

            if (canPost) {
                const deleteButton = document.createElement("button");
                deleteButton.className = "btn";
                deleteButton.type = "button";
                deleteButton.textContent = "DELETE";
                deleteButton.style.marginTop = "14px";
                deleteButton.addEventListener("click", async () => {
                    if (!confirm("Delete this announcement and its attachments?")) return;
                    const { data: files } = await supabaseClient
                        .from("announcement_attachments")
                        .select("file_path")
                        .eq("announcement_id", announcement.id);
                    if (files?.length) {
                        await supabaseClient.storage.from("announcements").remove(files.map(file => file.file_path));
                    }
                    const { error: deleteError } = await supabaseClient
                        .from("announcements")
                        .delete()
                        .eq("id", announcement.id);
                    if (deleteError) {
                        this.notify(deleteError.message || "Could not delete announcement.");
                        return;
                    }
                    this.notify("Announcement deleted.");
                    await this.showAnnouncements();
                });
                card.appendChild(deleteButton);
            }
            list.appendChild(card);
        }
    },

    escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            };

            return entities[character];
        });
    }
};

window.JudasApp = JudasApp;

document.addEventListener("DOMContentLoaded", () => {
    JudasApp.init();
});