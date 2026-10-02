import React, { useEffect, useState } from "react";
import { supabase } from "./assets/supabaseClient";
import "./App.css";

const MAX_STORAGE = 100 * 1024 * 1024;

function App() {
  // =========================================================
  // AUTH STATE
  // =========================================================

  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // =========================================================
  // APP STATE
  // =========================================================

  const [files, setFiles] = useState([]);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [activities, setActivities] = useState([]);
  const [folders, setFolders] = useState([]);

  const [currentFolder, setCurrentFolder] = useState("");
  const [activeSection, setActiveSection] =
    useState("dashboard");

  const [searchTerm, setSearchTerm] = useState("");

  const [uploading, setUploading] = useState(false);
  const [loadingFiles, setLoadingFiles] =
    useState(false);

  const [totalStorage, setTotalStorage] =
    useState(0);

  // =========================================================
  // MODAL STATE
  // =========================================================

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [previewFile, setPreviewFile] =
    useState(null);

  // =========================================================
  // AUTH CHECK
  // =========================================================

  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted) {
        setSession(session);
        setAuthLoading(false);
      }
    }

    getInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setAuthLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // =========================================================
  // LOAD DATA AFTER LOGIN / FOLDER CHANGE
  // =========================================================

  useEffect(() => {
    if (!session) return;

    loadFiles();
    loadSharedFiles();
    loadActivities();
    loadFolders();
    loadTotalStorage();
  }, [session, currentFolder]);

  // =========================================================
  // FORMAT BYTES
  // =========================================================

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) {
      return "0 Bytes";
    }

    const units = [
      "Bytes",
      "KB",
      "MB",
      "GB",
    ];

    const index = Math.floor(
      Math.log(bytes) / Math.log(1024)
    );

    return (
      parseFloat(
        (
          bytes /
          Math.pow(1024, index)
        ).toFixed(2)
      ) +
      " " +
      units[index]
    );
  }

  // =========================================================
  // FORMAT DATE
  // =========================================================

  function formatDate(date) {
    if (!date) return "-";

    return new Date(date).toLocaleString(
      "en-IN",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  }

  // =========================================================
  // FILE ICON
  // =========================================================

  function getFileIcon(fileName) {
    const extension =
      fileName
        ?.split(".")
        .pop()
        ?.toLowerCase();

    if (
      [
        "jpg",
        "jpeg",
        "png",
        "gif",
        "webp",
      ].includes(extension)
    ) {
      return "🖼️";
    }

    if (extension === "pdf") {
      return "📕";
    }

    if (
      ["doc", "docx"].includes(extension)
    ) {
      return "📘";
    }

    if (
      ["xls", "xlsx", "csv"].includes(
        extension
      )
    ) {
      return "📊";
    }

    if (
      ["ppt", "pptx"].includes(extension)
    ) {
      return "📙";
    }

    if (
      ["zip", "rar", "7z"].includes(extension)
    ) {
      return "🗜️";
    }

    if (
      ["mp3", "wav", "ogg"].includes(extension)
    ) {
      return "🎵";
    }

    if (
      ["mp4", "mov", "avi", "mkv"].includes(
        extension
      )
    ) {
      return "🎬";
    }

    if (
      ["txt", "md"].includes(extension)
    ) {
      return "📄";
    }

    return "📁";
  }

  // =========================================================
  // FILE TYPE
  // =========================================================

  function getFileType(fileName) {
    const extension =
      fileName
        ?.split(".")
        .pop()
        ?.toUpperCase();

    return extension || "FILE";
  }

  // =========================================================
  // STORAGE PATH
  // =========================================================

  function getFileBasePath() {
    if (!session?.user?.id) {
      return "";
    }

    if (currentFolder) {
      return `${session.user.id}/${currentFolder}`;
    }

    return session.user.id;
  }

  // =========================================================
  // ACTIVITY LOGGER
  // =========================================================

  async function logActivity(
    fileName,
    action
  ) {
    if (!session?.user?.id) return;

    const { error } = await supabase
      .from("file_activity")
      .insert({
        user_id: session.user.id,
        file_name: fileName,
        action,
      });

    if (error) {
      console.error(
        "Activity log error:",
        error
      );
    }
  }

  // =========================================================
  // LOAD FILES
  // =========================================================

  async function loadFiles() {
    if (!session?.user?.id) return;

    setLoadingFiles(true);

    const path = getFileBasePath();

    const {
      data,
      error,
    } = await supabase.storage
      .from("cloudvault-files")
      .list(path, {
        limit: 100,
        sortBy: {
          column: "created_at",
          order: "desc",
        },
      });

    if (error) {
      console.error(
        "File loading error:",
        error
      );

      setLoadingFiles(false);
      return;
    }

    const actualFiles =
      (data || []).filter(
        (file) => file.metadata
      );

    setFiles(
      actualFiles.map((file) => ({
        ...file,
        id:
          file.id ||
          `${file.name}-${file.created_at}`,
      }))
    );

    setLoadingFiles(false);
  }

  // =========================================================
  // LOAD FOLDERS
  // =========================================================

  async function loadFolders() {
    if (!session?.user?.id) return;

    const {
      data,
      error,
    } = await supabase
      .from("folders")
      .select("*")
      .eq(
        "user_id",
        session.user.id
      )
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Folder loading error:",
        error
      );
      return;
    }

    setFolders(
      (data || []).map((folder) => ({
        id: folder.id,
        name: folder.name,
        parent:
          folder.parent_path || "",
      }))
    );
  }

  // =========================================================
  // LOAD SHARED FILES
  // =========================================================

  async function loadSharedFiles() {
    if (!session?.user?.email) return;

    const {
      data,
      error,
    } = await supabase
      .from("shared_files")
      .select("*")
      .or(
        `owner_id.eq.${session.user.id},shared_with_email.eq.${session.user.email}`
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Shared files loading error:",
        error
      );
      return;
    }

    setSharedFiles(data || []);
  }

  // =========================================================
  // LOAD ACTIVITY
  // =========================================================

  async function loadActivities() {
    if (!session?.user?.id) return;

    const {
      data,
      error,
    } = await supabase
      .from("file_activity")
      .select("*")
      .eq(
        "user_id",
        session.user.id
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(20);

    if (error) {
      console.error(
        "Activity loading error:",
        error
      );
      return;
    }

    setActivities(data || []);
  }

  // =========================================================
  // LOAD TOTAL STORAGE
  // =========================================================

  async function loadTotalStorage() {
    if (!session?.user?.id) return;

    let total = 0;

    const rootPath =
      session.user.id;

    const {
      data: rootFiles,
      error: rootError,
    } = await supabase.storage
      .from("cloudvault-files")
      .list(rootPath, {
        limit: 100,
      });

    if (rootError) {
      console.error(
        "Root storage calculation error:",
        rootError
      );
      return;
    }

    total +=
      (rootFiles || []).reduce(
        (sum, file) =>
          sum +
          (file.metadata?.size || 0),
        0
      );

    const {
      data: folderData,
      error: folderError,
    } = await supabase
      .from("folders")
      .select(
        "name, parent_path"
      )
      .eq(
        "user_id",
        session.user.id
      );

    if (folderError) {
      console.error(
        "Folder storage calculation error:",
        folderError
      );
      return;
    }

    for (
      const folder of
      folderData || []
    ) {
      const folderPath =
        folder.parent_path
          ? `${session.user.id}/${folder.parent_path}/${folder.name}`
          : `${session.user.id}/${folder.name}`;

      const {
        data: folderFiles,
        error,
      } = await supabase.storage
        .from("cloudvault-files")
        .list(folderPath, {
          limit: 100,
        });

      if (error) {
        console.error(
          "Folder storage error:",
          error
        );
        continue;
      }

      total +=
        (folderFiles || []).reduce(
          (sum, file) =>
            sum +
            (file.metadata?.size ||
              0),
          0
        );
    }

    setTotalStorage(total);
  }

  // =========================================================
  // PART 2 YAHAN SE CONTINUE HOGA
  // =========================================================
    // =========================================================
  // AUTH — LOGIN
  // =========================================================

  async function handleLogin(e) {
    e.preventDefault();

    if (!email || !password) {
      alert("Email and password required.");
      return;
    }

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      alert(error.message);
      return;
    }

    setEmail("");
    setPassword("");
  }

  // =========================================================
  // AUTH — SIGN UP
  // =========================================================

  async function handleSignup(e) {
    e.preventDefault();

    if (!email || !password) {
      alert("Email and password required.");
      return;
    }

    if (password.length < 6) {
      alert(
        "Password must be at least 6 characters."
      );
      return;
    }

    const { error } =
      await supabase.auth.signUp({
        email,
        password,
      });

    if (error) {
      alert(error.message);
      return;
    }

    alert(
      "Account created. Please check your email if confirmation is enabled."
    );

    setAuthMode("login");
    setPassword("");
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  async function handleLogout() {
    await supabase.auth.signOut();

    setFiles([]);
    setSharedFiles([]);
    setActivities([]);
    setFolders([]);
    setCurrentFolder("");
    setTotalStorage(0);
    setActiveSection("dashboard");
  }

  // =========================================================
  // UPLOAD FILE
  // =========================================================

  async function handleUpload(
    event
  ) {
    const selected =
      event.target.files?.[0];

    if (!selected) return;

    // 100 MB LIMIT
    if (
      selected.size >
      MAX_STORAGE
    ) {
      alert(
        "File size cannot exceed 100 MB."
      );

      event.target.value = "";
      return;
    }

    // ALLOWED FILE TYPES
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/zip",
      "audio/mpeg",
      "audio/wav",
      "video/mp4",
      "video/webm",
    ];

    if (
      selected.type &&
      !allowedTypes.includes(
        selected.type
      )
    ) {
      alert(
        "This file type is not allowed."
      );

      event.target.value = "";
      return;
    }

    // STORAGE LIMIT
    if (
      totalStorage + selected.size >
      MAX_STORAGE
    ) {
      alert(
        "Storage limit of 100 MB would be exceeded."
      );

      event.target.value = "";
      return;
    }

    const basePath =
      getFileBasePath();

    const filePath =
      `${basePath}/${Date.now()}-${selected.name}`;

    setUploading(true);

    const {
      error,
    } = await supabase.storage
      .from("cloudvault-files")
      .upload(
        filePath,
        selected,
        {
          cacheControl: "3600",
          upsert: false,
        }
      );

    if (error) {
      console.error(
        "Upload error:",
        error
      );

      alert(
        `Upload failed: ${error.message}`
      );

      setUploading(false);
      event.target.value = "";
      return;
    }

    await logActivity(
      selected.name,
      "Uploaded"
    );

    await loadFiles();
    await loadActivities();
    await loadTotalStorage();

    setUploading(false);

    event.target.value = "";

    alert("File uploaded successfully.");
  }

  // =========================================================
  // DOWNLOAD FILE
  // =========================================================

  async function handleDownload(
    file
  ) {
    if (!session?.user?.id) return;

    const path =
      currentFolder
        ? `${session.user.id}/${currentFolder}/${file.name}`
        : `${session.user.id}/${file.name}`;

    const {
      data,
      error,
    } = await supabase.storage
      .from("cloudvault-files")
      .download(path);

    if (error) {
      console.error(
        "Download error:",
        error
      );

      alert(
        `Download failed: ${error.message}`
      );

      return;
    }

    const url =
      URL.createObjectURL(data);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = file.name;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    await logActivity(
      file.name,
      "Downloaded"
    );

    await loadActivities();
  }

  // =========================================================
  // DELETE FILE
  // =========================================================

  async function handleDelete(
    file
  ) {
    const confirmed =
      window.confirm(
        `Delete "${file.name}"?`
      );

    if (!confirmed) return;

    const path =
      currentFolder
        ? `${session.user.id}/${currentFolder}/${file.name}`
        : `${session.user.id}/${file.name}`;

    const {
      error,
    } = await supabase.storage
      .from("cloudvault-files")
      .remove([path]);

    if (error) {
      console.error(
        "Delete error:",
        error
      );

      alert(
        `Delete failed: ${error.message}`
      );

      return;
    }

    await logActivity(
      file.name,
      "Deleted"
    );

    await loadFiles();
    await loadActivities();
    await loadTotalStorage();

    if (
      selectedFile?.name ===
      file.name
    ) {
      setSelectedFile(null);
    }
  }

  // =========================================================
  // CREATE FOLDER
  // =========================================================

  async function handleCreateFolder() {
    const name =
      window.prompt(
        "Enter folder name:"
      );

    if (!name) return;

    const cleanName =
      name.trim();

    if (!cleanName) return;

    const duplicate =
      folders.some(
        (folder) =>
          folder.name
            .toLowerCase() ===
          cleanName.toLowerCase() &&
          folder.parent ===
            currentFolder
      );

    if (duplicate) {
      alert(
        "A folder with this name already exists."
      );
      return;
    }

    const {
      error,
    } = await supabase
      .from("folders")
      .insert({
        user_id:
          session.user.id,
        name: cleanName,
        parent_path:
          currentFolder || "",
      });

    if (error) {
      console.error(
        "Folder creation error:",
        error
      );

      alert(
        `Folder creation failed: ${error.message}`
      );

      return;
    }

    await loadFolders();

    alert(
      "Folder created successfully."
    );
  }

  // =========================================================
  // OPEN FOLDER
  // =========================================================

  function openFolder(
    folder
  ) {
    const nextPath =
      currentFolder
        ? `${currentFolder}/${folder.name}`
        : folder.name;

    setCurrentFolder(nextPath);
    setActiveSection("files");
  }

  // =========================================================
  // GO BACK FROM FOLDER
  // =========================================================

  function goBackFolder() {
    if (!currentFolder) return;

    const parts =
      currentFolder.split("/");

    parts.pop();

    setCurrentFolder(
      parts.join("/")
    );
  }

  // =========================================================
  // DELETE FOLDER
  // =========================================================

  async function handleDeleteFolder(
    folder
  ) {
    const confirmed =
      window.confirm(
        `Delete folder "${folder.name}"?`
      );

    if (!confirmed) return;

    const {
      error,
    } = await supabase
      .from("folders")
      .delete()
      .eq(
        "id",
        folder.id
      );

    if (error) {
      console.error(
        "Folder delete error:",
        error
      );

      alert(
        `Folder delete failed: ${error.message}`
      );

      return;
    }

    await loadFolders();

    if (
      currentFolder ===
      folder.name
    ) {
      setCurrentFolder("");
    }
  }

  // =========================================================
  // SHARE FILE
  // =========================================================

  async function handleShare(
    file
  ) {
    const recipient =
      window.prompt(
        "Enter the email address to share this file with:"
      );

    if (!recipient) return;

    const sharedEmail =
      recipient.trim().toLowerCase();

    if (!sharedEmail) return;

    const filePath =
      currentFolder
        ? `${session.user.id}/${currentFolder}/${file.name}`
        : `${session.user.id}/${file.name}`;

    const {
      error,
    } = await supabase
      .from("shared_files")
      .insert({
        owner_id:
          session.user.id,
        shared_with_email:
          sharedEmail,
        file_path:
          filePath,
      });

    if (error) {
      console.error(
        "Share error:",
        error
      );

      alert(
        `Share failed: ${error.message}`
      );

      return;
    }

    await logActivity(
      file.name,
      `Shared with ${sharedEmail}`
    );

    await loadSharedFiles();
    await loadActivities();

    alert(
      `File shared with ${sharedEmail}.`
    );
  }

  // =========================================================
  // RENAME FILE
  // =========================================================

  async function handleRename(
    file
  ) {
    const newName =
      window.prompt(
        "Enter new file name:",
        file.name
      );

    if (!newName) return;

    const cleanName =
      newName.trim();

    if (
      !cleanName ||
      cleanName === file.name
    ) {
      return;
    }

    const oldPath =
      currentFolder
        ? `${session.user.id}/${currentFolder}/${file.name}`
        : `${session.user.id}/${file.name}`;

    const newPath =
      currentFolder
        ? `${session.user.id}/${currentFolder}/${cleanName}`
        : `${session.user.id}/${cleanName}`;

    const {
      error,
    } = await supabase.storage
      .from("cloudvault-files")
      .move(
        oldPath,
        newPath
      );

    if (error) {
      console.error(
        "Rename error:",
        error
      );

      alert(
        `Rename failed: ${error.message}`
      );

      return;
    }

    await logActivity(
      cleanName,
      `Renamed from ${file.name}`
    );

    await loadFiles();
    await loadActivities();

    alert(
      "File renamed successfully."
    );
  }

  // =========================================================
  // FILE DETAILS
  // =========================================================

  function handleDetails(
    file
  ) {
    setSelectedFile(file);
  }

  // =========================================================
  // PREVIEW
  // =========================================================

  function handlePreview(
    file
  ) {
    setPreviewFile(file);
  }

  // =========================================================
  // BREADCRUMB
  // =========================================================

  function getBreadcrumbs() {
    if (!currentFolder) {
      return [];
    }

    return currentFolder
      .split("/")
      .filter(Boolean);
  }

  // =========================================================
  // FILTER FILES
  // =========================================================

  const filteredFiles =
    files.filter((file) =>
      file.name
        .toLowerCase()
        .includes(
          searchTerm.toLowerCase()
        )
    );

  // =========================================================
  // STORAGE PERCENTAGE
  // =========================================================

  const storagePercentage =
    Math.min(
      (totalStorage /
        MAX_STORAGE) *
        100,
      100
    );

  // =========================================================
  // DASHBOARD COUNTS
  // =========================================================

  const totalFiles =
    files.length;

  const totalFolders =
    folders.filter(
      (folder) =>
        folder.parent ===
        currentFolder
    ).length;

  const totalShared =
    sharedFiles.filter(
      (item) =>
        item.owner_id ===
        session?.user?.id
    ).length;

  // =========================================================
  // PART 3 WILL CONTINUE HERE
  // =========================================================
    // =========================================================
  // AUTH SCREEN
  // =========================================================

  if (authLoading) {
    return (
      <div className="auth-screen">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading CloudVault...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-screen">
        <div className="auth-card">

          <div className="auth-logo">
            ☁
          </div>

          <h1 className="auth-title">
            CloudVault
          </h1>

          <p className="auth-subtitle">
            Secure cloud file storage with
            simple access control.
          </p>

          <form
            className="auth-form"
            onSubmit={
              authMode === "login"
                ? handleLogin
                : handleSignup
            }
          >
            <div className="form-group">
              <label>
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="form-group">
              <label>
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              className="auth-button"
            >
              {authMode === "login"
                ? "Login"
                : "Create Account"}
            </button>
          </form>

          <div className="auth-switch">
            {authMode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}

            <button
              type="button"
              onClick={() =>
                setAuthMode(
                  authMode === "login"
                    ? "signup"
                    : "login"
                )
              }
            >
              {authMode === "login"
                ? "Sign up"
                : "Login"}
            </button>
          </div>

        </div>
      </div>
    );
  }

  // =========================================================
  // CURRENT FOLDER NAME
  // =========================================================

  const currentFolderName =
    currentFolder
      ? currentFolder
          .split("/")
          .filter(Boolean)
          .pop()
      : "Dashboard";

  // =========================================================
  // CURRENT FOLDER OBJECTS
  // =========================================================

  const visibleFolders =
    folders.filter(
      (folder) =>
        folder.parent ===
        currentFolder
    );

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="app">

      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <aside className="sidebar">

        <div className="brand">
          <div className="brand-icon">
            ☁
          </div>

          <div className="brand-text">
            <div className="brand-title">
              CloudVault
            </div>

            <div className="brand-subtitle">
              SECURE STORAGE
            </div>
          </div>
        </div>

        <nav>
          <div className="nav-menu">

            <div className="nav-section-title">
              Workspace
            </div>

            <button
              className={`nav-item ${
                activeSection ===
                "dashboard"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setActiveSection(
                  "dashboard"
                )
              }
            >
              <span>🏠</span>
              <span>Dashboard</span>
            </button>

            <button
              className={`nav-item ${
                activeSection === "files"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setActiveSection("files")
              }
            >
              <span>📁</span>
              <span>My Files</span>
            </button>

            <button
              className={`nav-item ${
                activeSection === "shared"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setActiveSection(
                  "shared"
                )
              }
            >
              <span>🤝</span>
              <span>Shared With Me</span>
            </button>

            <button
              className={`nav-item ${
                activeSection === "activity"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setActiveSection(
                  "activity"
                )
              }
            >
              <span>🕘</span>
              <span>Activity</span>
            </button>

          </div>
        </nav>

        <div className="sidebar-bottom">

          <div className="account-card">

            <div className="account-avatar">
              {session.user.email
                ?.charAt(0)
                .toUpperCase()}
            </div>

            <div className="account-info">

              <div className="account-name">
                {session.user.email}
              </div>

              <div className="account-email">
                Free Account
              </div>

            </div>

          </div>

        </div>

      </aside>

      {/* =====================================================
          MAIN
          ===================================================== */}

      <main className="main">

        {/* ===================================================
            TOPBAR
            =================================================== */}

        <header className="topbar">

          <div className="topbar-left">

            <div className="page-title">
              {activeSection ===
                "dashboard" &&
                "Dashboard"}

              {activeSection ===
                "files" &&
                "My Files"}

              {activeSection ===
                "shared" &&
                "Shared With Me"}

              {activeSection ===
                "activity" &&
                "Activity"}
            </div>

            <div className="page-subtitle">
              Manage your files securely
              from one place.
            </div>

          </div>

          <div className="search-box">

            <span>🔎</span>

            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) =>
                setSearchTerm(
                  e.target.value
                )
              }
            />

          </div>

          <div className="topbar-actions">

            <button
              className="icon-button"
              title="Refresh"
              onClick={() => {
                loadFiles();
                loadSharedFiles();
                loadActivities();
                loadFolders();
                loadTotalStorage();
              }}
            >
              ↻
            </button>

            <button
              className="profile-button"
              onClick={handleLogout}
              title="Logout"
            >
              <div className="profile-avatar">
                {session.user.email
                  ?.charAt(0)
                  .toUpperCase()}
              </div>

              <span className="profile-name">
                Logout
              </span>
            </button>

          </div>

        </header>

        {/* ===================================================
            DASHBOARD
            =================================================== */}

        {activeSection ===
          "dashboard" && (
          <section>

            <div className="dashboard-header">

              <div>
                <h2>
                  Welcome to CloudVault
                </h2>

                <p>
                  Your secure file workspace
                  at a glance.
                </p>
              </div>

              <button
                className="primary-button"
                onClick={() =>
                  setActiveSection(
                    "files"
                  )
                }
              >
                📁 View Files
              </button>

            </div>

            <div className="stats-grid">

              <div className="stat-card">

                <div className="stat-icon">
                  📄
                </div>

                <div className="stat-content">

                  <div className="stat-label">
                    Total Files
                  </div>

                  <div className="stat-value">
                    {totalFiles}
                  </div>

                </div>

              </div>

              <div className="stat-card">

                <div className="stat-icon">
                  💾
                </div>

                <div className="stat-content">

                  <div className="stat-label">
                    Storage Used
                  </div>

                  <div className="stat-value">
                    {formatBytes(
                      totalStorage
                    )}
                  </div>

                </div>

              </div>

              <div className="stat-card">

                <div className="stat-icon">
                  📂
                </div>

                <div className="stat-content">

                  <div className="stat-label">
                    Folders
                  </div>

                  <div className="stat-value">
                    {totalFolders}
                  </div>

                </div>

              </div>

              <div className="stat-card">

                <div className="stat-icon">
                  🤝
                </div>

                <div className="stat-content">

                  <div className="stat-label">
                    Shared Files
                  </div>

                  <div className="stat-value">
                    {totalShared}
                  </div>

                </div>

              </div>

            </div>

            <div className="content-grid">

              <div className="content-card">

                <div className="content-card-header">

                  <div>
                    <h3>
                      Quick Actions
                    </h3>

                    <p>
                      Common file operations
                    </p>
                  </div>

                </div>

                <div className="quick-actions">

                  <button
                    className="quick-action"
                    onClick={() =>
                      setActiveSection(
                        "files"
                      )
                    }
                  >
                    <div className="quick-action-icon">
                      📁
                    </div>

                    <div className="quick-action-text">
                      <div className="quick-action-title">
                        My Files
                      </div>

                      <div className="quick-action-subtitle">
                        Manage your files
                      </div>
                    </div>
                  </button>

                  <button
                    className="quick-action"
                    onClick={
                      handleCreateFolder
                    }
                  >
                    <div className="quick-action-icon">
                      📂
                    </div>

                    <div className="quick-action-text">
                      <div className="quick-action-title">
                        New Folder
                      </div>

                      <div className="quick-action-subtitle">
                        Organize your files
                      </div>
                    </div>
                  </button>

                </div>

              </div>

              <div className="content-card">

                <div className="content-card-header">

                  <div>
                    <h3>
                      Storage
                    </h3>

                    <p>
                      100 MB project limit
                    </p>
                  </div>

                </div>

                <div className="storage-card">

                  <div className="storage-header">

                    <div className="storage-title">
                      Storage Used
                    </div>

                    <div className="storage-value">
                      {formatBytes(
                        totalStorage
                      )}
                    </div>

                  </div>

                  <div className="storage-bar">

                    <div
                      className="storage-progress"
                      style={{
                        width: `${storagePercentage}%`,
                      }}
                    />

                  </div>

                  <div className="storage-info">

                    <span>
                      {formatBytes(
                        totalStorage
                      )}
                    </span>

                    <span>
                      100 MB
                    </span>

                  </div>

                </div>

              </div>

            </div>

            <div className="content-card">

              <div className="content-card-header">

                <div>
                  <h3>
                    Security
                  </h3>

                  <p>
                    Your files are protected
                  </p>
                </div>

              </div>

              <div style={{ padding: "14px" }}>

                <div className="security-card">

                  <div className="security-icon">
                    🔒
                  </div>

                  <div className="security-info">

                    <div className="security-title">
                      Secure Access Control
                    </div>

                    <div className="security-text">
                      Files are isolated by
                      user account and shared
                      only with authorized
                      users.
                    </div>

                  </div>

                </div>

              </div>

            </div>

          </section>
        )}

        {/* ===================================================
            PART 4 WILL CONTINUE HERE
            =================================================== */}
                    {/* ===================================================
            MY FILES
            =================================================== */}

        {activeSection === "files" && (
          <section>

            <div className="section-header">

              <div>
                <div className="section-title">
                  {currentFolder
                    ? currentFolderName
                    : "My Files"}
                </div>

                <div className="section-subtitle">
                  {currentFolder
                    ? `Current folder: /${currentFolder}`
                    : "Manage and organize your files"}
                </div>
              </div>

              <div className="file-controls">

                <button
                  className="secondary-button"
                  onClick={
                    handleCreateFolder
                  }
                >
                  📂 New Folder
                </button>

                <label className="primary-button">
                  ⬆ Upload

                  <input
                    type="file"
                    hidden
                    onChange={
                      handleUpload
                    }
                  />
                </label>

              </div>

            </div>

            {/* BREADCRUMB */}

            {currentFolder && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  marginBottom: "12px",
                  fontSize: "10px",
                  color: "#667085",
                }}
              >
                <button
                  className="secondary-button"
                  onClick={() =>
                    setCurrentFolder("")
                  }
                >
                  Home
                </button>

                {getBreadcrumbs().map(
                  (part, index) => (
                    <React.Fragment
                      key={`${part}-${index}`}
                    >
                      <span>/</span>

                      <button
                        className="secondary-button"
                        onClick={() => {
                          const path =
                            getBreadcrumbs()
                              .slice(
                                0,
                                index + 1
                              )
                              .join("/");

                          setCurrentFolder(
                            path
                          );
                        }}
                      >
                        {part}
                      </button>
                    </React.Fragment>
                  )
                )}

                <button
                  className="secondary-button"
                  onClick={
                    goBackFolder
                  }
                >
                  ← Back
                </button>
              </div>
            )}

            {/* UPLOADING */}

            {uploading && (
              <div
                style={{
                  marginBottom: "12px",
                }}
              >
                <div className="uploading-indicator">
                  <div className="uploading-spinner" />
                  Uploading file...
                </div>
              </div>
            )}

            {/* FOLDERS */}

            {visibleFolders.length > 0 && (
              <div
                className="content-card"
                style={{
                  marginBottom: "14px",
                }}
              >

                <div className="content-card-header">

                  <div>
                    <h3>
                      Folders
                    </h3>

                    <p>
                      Open a folder to view
                      its files
                    </p>
                  </div>

                </div>

                <div className="folder-grid">

                  {visibleFolders.map(
                    (folder) => (
                      <div
                        className="folder-card"
                        key={folder.id}
                        onClick={() =>
                          openFolder(
                            folder
                          )
                        }
                      >

                        <div className="folder-icon">
                          📂
                        </div>

                        <div className="folder-info">

                          <div className="folder-name">
                            {folder.name}
                          </div>

                          <div className="folder-meta">
                            Folder
                          </div>

                        </div>

                        <button
                          className="file-action danger"
                          onClick={(e) => {
                            e.stopPropagation();

                            handleDeleteFolder(
                              folder
                            );
                          }}
                          title="Delete folder"
                        >
                          🗑
                        </button>

                      </div>
                    )
                  )}

                </div>

              </div>
            )}

            {/* FILE LIST */}

            <div className="file-list-container">

              <div className="file-list-header">

                <div>
                  Name
                </div>

                <div>
                  Size
                </div>

                <div>
                  Date
                </div>

                <div>
                  Type
                </div>

                <div>
                  Actions
                </div>

              </div>

              {loadingFiles ? (
                <div className="loading-container">
                  <div className="loading-spinner" />
                  <p>
                    Loading files...
                  </p>
                </div>
              ) : filteredFiles.length ===
                0 ? (
                <div className="empty-state">

                  <div className="empty-state-icon">
                    📁
                  </div>

                  <h3>
                    No files found
                  </h3>

                  <p>
                    Upload a file to get
                    started with CloudVault.
                  </p>

                </div>
              ) : (
                filteredFiles.map(
                  (file) => (
                    <div
                      className="file-row"
                      key={file.id}
                    >

                      {/* FILE NAME */}

                      <div className="file-name-cell">

                        <div className="file-name-icon">
                          {getFileIcon(
                            file.name
                          )}
                        </div>

                        <div className="file-name-info">

                          <div className="file-name">
                            {file.name}
                          </div>

                          <div className="file-subtext">
                            CloudVault storage
                          </div>

                        </div>

                      </div>

                      {/* SIZE */}

                      <div className="file-meta">
                        {formatBytes(
                          file.metadata
                            ?.size || 0
                        )}
                      </div>

                      {/* DATE */}

                      <div className="file-date">
                        {formatDate(
                          file.created_at
                        )}
                      </div>

                      {/* TYPE */}

                      <div>
                        <span className="file-type">
                          {getFileType(
                            file.name
                          )}
                        </span>
                      </div>

                      {/* ACTIONS */}

                      <div className="file-actions">

                        <button
                          className="file-action"
                          title="Preview"
                          onClick={() =>
                            handlePreview(
                              file
                            )
                          }
                        >
                          👁
                        </button>

                        <button
                          className="file-action"
                          title="Details"
                          onClick={() =>
                            handleDetails(
                              file
                            )
                          }
                        >
                          ℹ
                        </button>

                        <button
                          className="file-action"
                          title="Download"
                          onClick={() =>
                            handleDownload(
                              file
                            )
                          }
                        >
                          ⬇
                        </button>

                        <button
                          className="file-action"
                          title="Share"
                          onClick={() =>
                            handleShare(
                              file
                            )
                          }
                        >
                          🤝
                        </button>

                        <button
                          className="file-action"
                          title="Rename"
                          onClick={() =>
                            handleRename(
                              file
                            )
                          }
                        >
                          ✎
                        </button>

                        <button
                          className="file-action danger"
                          title="Delete"
                          onClick={() =>
                            handleDelete(
                              file
                            )
                          }
                        >
                          🗑
                        </button>

                      </div>

                    </div>
                  )
                )
              )}

            </div>

          </section>
        )}

        {/* ===================================================
            SHARED FILES
            =================================================== */}

        {activeSection ===
          "shared" && (
          <section>

            <div className="section-header">

              <div>
                <div className="section-title">
                  Shared With Me
                </div>

                <div className="section-subtitle">
                  Files shared through
                  CloudVault
                </div>
              </div>

            </div>

            <div className="file-list-container">

              <div className="file-list-header">

                <div>
                  File
                </div>

                <div>
                  Owner
                </div>

                <div>
                  Shared On
                </div>

                <div>
                  Type
                </div>

                <div>
                  Action
                </div>

              </div>

              {sharedFiles.length ===
              0 ? (
                <div className="empty-state">

                  <div className="empty-state-icon">
                    🤝
                  </div>

                  <h3>
                    No shared files
                  </h3>

                  <p>
                    Files shared with you
                    will appear here.
                  </p>

                </div>
              ) : (
                sharedFiles
                  .filter(
                    (item) =>
                      item.owner_id !==
                      session.user.id
                  )
                  .map(
                    (item) => {

                      const sharedName =
                        item.file_path
                          ?.split("/")
                          .pop()
                          ?.replace(
                            /^\d+-/,
                            ""
                          ) ||
                        "Shared file";

                      return (
                        <div
                          className="file-row"
                          key={item.id}
                        >

                          <div className="file-name-cell">

                            <div className="file-name-icon">
                              {getFileIcon(
                                sharedName
                              )}
                            </div>

                            <div className="file-name-info">

                              <div className="file-name">
                                {sharedName}
                              </div>

                              <div className="file-subtext">
                                Shared with your
                                account
                              </div>

                            </div>

                          </div>

                          <div className="file-meta">
                            Shared user
                          </div>

                          <div className="file-date">
                            {formatDate(
                              item.created_at
                            )}
                          </div>

                          <div>
                            <span className="file-type">
                              {getFileType(
                                sharedName
                              )}
                            </span>
                          </div>

                          <div className="file-actions">

                            <button
                              className="file-action"
                              title="Download"
                              onClick={async () => {
                                const {
                                  data,
                                  error,
                                } =
                                  await supabase.storage
                                    .from(
                                      "cloudvault-files"
                                    )
                                    .download(
                                      item.file_path
                                    );

                                if (
                                  error
                                ) {
                                  alert(
                                    `Download failed: ${error.message}`
                                  );
                                  return;
                                }

                                const url =
                                  URL.createObjectURL(
                                    data
                                  );

                                const link =
                                  document.createElement(
                                    "a"
                                  );

                                link.href =
                                  url;

                                link.download =
                                  sharedName;

                                document.body.appendChild(
                                  link
                                );

                                link.click();

                                link.remove();

                                URL.revokeObjectURL(
                                  url
                                );
                              }}
                            >
                              ⬇
                            </button>

                          </div>

                        </div>
                      );
                    }
                  )
              )}

            </div>

          </section>
        )}

        {/* ===================================================
            ACTIVITY
            =================================================== */}

        {activeSection ===
          "activity" && (
          <section>

            <div className="section-header">

              <div>
                <div className="section-title">
                  Activity History
                </div>

                <div className="section-subtitle">
                  Recent activity on your
                  CloudVault account
                </div>
              </div>

            </div>

            <div className="content-card">

              <div className="activity-list">

                {activities.length ===
                0 ? (
                  <div className="empty-state">

                    <div className="empty-state-icon">
                      🕘
                    </div>

                    <h3>
                      No activity yet
                    </h3>

                    <p>
                      Your file activity
                      will appear here.
                    </p>

                  </div>
                ) : (
                  activities.map(
                    (activity) => (
                      <div
                        className="activity-item"
                        key={activity.id}
                      >

                        <div className="activity-icon">
                          📝
                        </div>

                        <div className="activity-info">

                          <strong>
                            {activity.action}
                          </strong>

                          <span>
                            {activity.file_name}
                          </span>

                        </div>

                        <div className="activity-time">
                          {formatDate(
                            activity.created_at
                          )}
                        </div>

                      </div>
                    )
                  )
                )}

              </div>

            </div>

          </section>
        )}

        {/* ===================================================
            FILE DETAILS MODAL
            =================================================== */}

        {selectedFile && (
          <div
            className="modal-overlay"
            onClick={() =>
              setSelectedFile(null)
            }
          >

            <div
              className="modal"
              onClick={(e) =>
                e.stopPropagation()
              }
            >

              <div className="modal-header">

                <h2>
                  File Details
                </h2>

                <button
                  className="modal-close"
                  onClick={() =>
                    setSelectedFile(
                      null
                    )
                  }
                >
                  ✕
                </button>

              </div>

              <div className="modal-body">

                <div className="details-grid">

                  <div className="detail-item">

                    <div className="detail-label">
                      Name
                    </div>

                    <div className="detail-value">
                      {selectedFile.name}
                    </div>

                  </div>

                  <div className="detail-item">

                    <div className="detail-label">
                      Type
                    </div>

                    <div className="detail-value">
                      {getFileType(
                        selectedFile.name
                      )}
                    </div>

                  </div>

                  <div className="detail-item">

                    <div className="detail-label">
                      Size
                    </div>

                    <div className="detail-value">
                      {formatBytes(
                        selectedFile
                          .metadata
                          ?.size || 0
                      )}
                    </div>

                  </div>

                  <div className="detail-item">

                    <div className="detail-label">
                      Created
                    </div>

                    <div className="detail-value">
                      {formatDate(
                        selectedFile.created_at
                      )}
                    </div>

                  </div>

                  <div className="detail-item">

                    <div className="detail-label">
                      Current Folder
                    </div>

                    <div className="detail-value">
                      /{currentFolder}
                    </div>

                  </div>

                  <div className="detail-item">

                    <div className="detail-label">
                      Storage
                    </div>

                    <div className="detail-value">
                      CloudVault
                    </div>

                  </div>

                </div>

              </div>

              <div className="modal-footer">

                <button
                  className="secondary-button"
                  onClick={() =>
                    setSelectedFile(
                      null
                    )
                  }
                >
                  Close
                </button>

                <button
                  className="primary-button"
                  onClick={() => {
                    setSelectedFile(
                      null
                    );

                    handleDownload(
                      selectedFile
                    );
                  }}
                >
                  ⬇ Download
                </button>

              </div>

            </div>

          </div>
        )}

        {/* ===================================================
            PREVIEW MODAL
            =================================================== */}

        {previewFile && (
          <div
            className="modal-overlay"
            onClick={() =>
              setPreviewFile(null)
            }
          >

            <div
              className="preview-modal"
              onClick={(e) =>
                e.stopPropagation()
              }
            >

              <div className="modal-header">

                <h2>
                  {previewFile.name}
                </h2>

                <button
                  className="modal-close"
                  onClick={() =>
                    setPreviewFile(
                      null
                    )
                  }
                >
                  ✕
                </button>

              </div>

              <div className="preview-content">

                {previewFile.metadata
                  ?.mimetype?.startsWith(
                    "image/"
                  ) ? (
                  <img
                    src={URL.createObjectURL(
                      previewFile
                    )}
                    alt={
                      previewFile.name
                    }
                  />
                ) : (
                  <div className="preview-placeholder">

                    <div className="preview-placeholder-icon">
                      {getFileIcon(
                        previewFile.name
                      )}
                    </div>

                    <h3>
                      Preview not available
                    </h3>

                    <p>
                      This file type cannot
                      be previewed directly.
                      You can download the
                      file to open it on your
                      device.
                    </p>

                    <button
                      className="primary-button"
                      style={{
                        marginTop: "12px",
                      }}
                      onClick={() =>
                        handleDownload(
                          previewFile
                        )
                      }
                    >
                      ⬇ Download File
                    </button>

                  </div>
                )}

              </div>

            </div>

          </div>
        )}

      </main>

    </div>
  );
}

export default App;