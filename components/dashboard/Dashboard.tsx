"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useCallback, useEffect } from "react";
// import UploadArea from "./UploadArea"; // Replaced by MultiUploadArea
import MultiUploadArea from "./MultiUploadArea";
import AnalysisStatus from "./AnalysisStatus";
import StudentHistory from "./StudentHistory";
import HistoryErrorBoundary from "./HistoryErrorBoundary";
import { useRouter } from "next/navigation";
import StudentSelector from "./StudentSelector";
import AddStudentModal from "./AddStudentModal";
import TrialExpiredGate from "./TrialExpiredGate";
import NewsTicker from "./NewsTicker";
import { useSession } from "next-auth/react";
import { DEFAULT_SUBJECT, SUBJECT_OPTIONS, normalizeSubjectLabel } from "@/lib/subjects";
import { getReviewFocusTitle, summarizeReviewFocus } from "@/lib/reviewFocus";

export default function Dashboard() {
    type DeviceItem = {
        id: string;
        name?: string | null;
        last_active_at?: string | null;
    };
    type WeaknessArea = { topic?: string; level?: string };
    type QuestionMistake = {
        question_label?: string;
        topic?: string;
        result?: "wrong" | "partial";
        lost_points?: number | null;
    };
    type AnalysisResult = {
        test_score?: number;
        test_score_raw?: number | string;
        raw_test_score?: number | string;
        input_test_score?: number | string;
        exam_phase?: boolean;
        provisional?: boolean;
        comprehension_score?: number;
        comprehension_details?: {
            accuracy: number;
            question_accuracy?: number;
            process: number;
            consistency: number;
        };
        insight_bullets?: string[];
        insight_conclusion?: string;
        covered_topics?: string[];
        weakness_areas?: WeaknessArea[];
        wrong_question_topics?: string[];
        question_mistakes?: QuestionMistake[];
        review_focuses?: string[];
        disclaimer?: string;
        [key: string]: unknown;
    };

    const { data: session, status: authStatus } = useSession();
    const router = useRouter();

    // 1. Session Kickout Check
    useEffect(() => {
        const sessionError = (session as { error?: string } | null)?.error;
        if (sessionError === "ForceLogout") {
            alert("セキュリティ保護のため、別端末からのログインを検知しました。再ログインしてください。");
            fetch("/api/auth/logout", { method: "POST" })
                .catch((e) => console.error("Force logout cleanup failed", e))
                .finally(() => {
                    window.location.assign("/");
                });
        }
    }, [session]);

    // Payment Success Handing
    useEffect(() => {
        const query = new URLSearchParams(window.location.search);
        if (query.get("payment") === "success") {
            alert("本契約ありがとうございます！\n制限が解除されました。");
            // Clear URL
            window.history.replaceState({}, "", "/dashboard");
        }
    }, []);

    // State
    const [status, setStatus] = useState<"idle" | "uploading" | "analyzing" | "completed" | "error">("idle");
    const [result, setResult] = useState<AnalysisResult | null>(null); // Analysis Result JSON
    const [analysisId, setAnalysisId] = useState<string | null>(null); // DB ID
    const [errorMsg, setErrorMsg] = useState("");
    const [deviceError, setDeviceError] = useState(false); // New state for device block
    const [deviceErrorCode, setDeviceErrorCode] = useState<string | null>(null);
    const [blockedDevices, setBlockedDevices] = useState<DeviceItem[]>([]);
    const [currentDeviceId, setCurrentDeviceId] = useState<string>("");
    const [currentDeviceName, setCurrentDeviceName] = useState<string>("");
    const [isReplacingDevice, setIsReplacingDevice] = useState(false);

    // Device Check State
    const [isDeviceVerified, setIsDeviceVerified] = useState(false);
    // const [deviceError, setDeviceError] = useState<string | null>(null); // This line is removed as per instruction

    // V2: Analysis Options
    const [unitName, setUnitName] = useState("");
    const [subject, setSubject] = useState<string>(DEFAULT_SUBJECT);
    const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
    const [examPhase, setExamPhase] = useState(false);
    const [isProblemLocked, setIsProblemLocked] = useState(false);
    const [subscriptionStatus, setSubscriptionStatus] = useState<string>("trialing");
    const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

    // Omni-Scan State: Multi-file support
    const [answerSheetFiles, setAnswerSheetFiles] = useState<File[]>([]);
    const [problemSheetFiles, setProblemSheetFiles] = useState<File[]>([]);

    // Student Management State
    type Student = { id: string; name: string; name_kana?: string; grade?: string; target_school?: string; notes?: string };
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string>("");
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [isEditStudentModalOpen, setIsEditStudentModalOpen] = useState(false);
    const [isFamilyHost, setIsFamilyHost] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
    const [editingField, setEditingField] = useState<null | "student" | "subject" | "score" | "testDate">(null);
    const [draftValue, setDraftValue] = useState<string>("");
    const [isSavingField, setIsSavingField] = useState(false);
    const [fieldError, setFieldError] = useState("");
    const subjectOptions = SUBJECT_OPTIONS;
    const logoutHref = "/api/auth/logout?callbackUrl=%2F";

    const isDevicePolicyErrorCode = (code?: string | null) =>
        code === "DeviceLimitExceeded" || code === "TrialAbuseDetected";

    const fetchBlockedDeviceList = useCallback(async () => {
        try {
            const listRes = await fetch("/api/org/device/list");
            if (!listRes.ok) return;
            const listData = await listRes.json();
            if (Array.isArray(listData?.devices)) {
                setBlockedDevices(listData.devices);
            }
        } catch (e) {
            console.error("Failed to fetch blocked device list", e);
        }
    }, []);

    useEffect(() => {
        if (isDeviceVerified && (subscriptionStatus === 'past_due' || subscriptionStatus === 'canceled' || subscriptionStatus === 'unpaid')) {
            router.push('/expired');
        }
    }, [isDeviceVerified, subscriptionStatus, router]);

    // 2. Device Fingerprint Logic
    const runDeviceCheck = useCallback(async () => {
        if (authStatus !== "authenticated") return;

        try {
            const nav = navigator as Navigator & { deviceMemory?: number };
            const storedDeviceId = localStorage.getItem("score_snap_device_id");
            const fingerprintParts = [
                navigator.userAgent,
                navigator.language,
                navigator.platform,
                String(navigator.hardwareConcurrency || ""),
                String(nav.deviceMemory || ""),
                String(screen.width),
                String(screen.height),
                String(screen.colorDepth),
                String(new Date().getTimezoneOffset())
            ].join("|");
            let computedFingerprint = "";
            try {
                if (window.crypto?.subtle) {
                    const data = new TextEncoder().encode(fingerprintParts);
                    const hash = await window.crypto.subtle.digest("SHA-256", data);
                    const hashArray = Array.from(new Uint8Array(hash));
                    computedFingerprint = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
                } else {
                    computedFingerprint = fingerprintParts;
                }
            } catch {
                computedFingerprint = fingerprintParts;
            }

            const deviceIdToUse = storedDeviceId || computedFingerprint;
            setCurrentDeviceId(deviceIdToUse || "");
            setCurrentDeviceName(navigator.userAgent || "Unknown Device");

            const res = await fetch("/api/org/device/check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deviceId: deviceIdToUse })
            });

            if (!res.ok) {
                const text = await res.text();
                try {
                    const data = JSON.parse(text);
                    if (!data.success && isDevicePolicyErrorCode(data.error)) {
                        setDeviceError(true);
                        setDeviceErrorCode(data.error || "Unknown");
                        setBlockedDevices(data.devices || []);
                        if (data.error === "DeviceLimitExceeded" && (!Array.isArray(data.devices) || data.devices.length === 0)) {
                            await fetchBlockedDeviceList();
                        }
                        return;
                    }
                } catch {
                    console.error("Device check returned non-JSON error:", res.status, text.substring(0, 500));
                }
                setIsDeviceVerified(true);
                return;
            }

            const data = await res.json();
            if (data && data.success === false && isDevicePolicyErrorCode(data.error)) {
                setDeviceError(true);
                setDeviceErrorCode(data.error || "Unknown");
                setBlockedDevices(data.devices || []);
                if (data.error === "DeviceLimitExceeded" && (!Array.isArray(data.devices) || data.devices.length === 0)) {
                    await fetchBlockedDeviceList();
                }
                return;
            }
            setDeviceError(false);
            setDeviceErrorCode(null);
            setBlockedDevices([]);

            if (data.isNewDevice && data.deviceId) {
                localStorage.setItem("score_snap_device_id", data.deviceId);
            }
            if (!storedDeviceId && computedFingerprint) {
                localStorage.setItem("score_snap_device_id", computedFingerprint);
            }
            setSubscriptionStatus(data.subscriptionStatus || "trialing");
            setTrialEndsAt(data.trialEndsAt || null);
            setIsDeviceVerified(true);

        } catch (e) {
            console.error("Device check failed", e);
            setIsDeviceVerified(true);
        }
    }, [authStatus, fetchBlockedDeviceList]);

    useEffect(() => {
        runDeviceCheck();
    }, [runDeviceCheck]);

    useEffect(() => {
        const familyHost = (process.env.NEXT_PUBLIC_FAMILY_HOST || "family.10snap.win").toLowerCase();
        setIsFamilyHost(window.location.hostname.toLowerCase() === familyHost);
    }, []);

    const handleReplaceDevice = async (removeDeviceId: string) => {
        if (!currentDeviceId) return;
        setIsReplacingDevice(true);
        try {
            const res = await fetch("/api/org/device/replace", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    removeDeviceId,
                    deviceId: currentDeviceId,
                    deviceName: currentDeviceName
                })
            });
            if (!res.ok) throw new Error("Replace failed");
            setDeviceError(false);
            setDeviceErrorCode(null);
            setBlockedDevices([]);
            await runDeviceCheck();
        } catch (e) {
            console.error(e);
            alert("デバイスの入れ替えに失敗しました");
        } finally {
            setIsReplacingDevice(false);
        }
    };

    // Load Students on Mount
    useEffect(() => {
        if (authStatus !== "authenticated") return;

        const fetchStudents = async () => {
            try {
                const res = await fetch("/api/students");
                if (res.ok) {
                    const data = await res.json();
                    setStudents(data.students);
                }
            } catch (e) {
                console.error("Failed to load students", e);
            }
        };
        fetchStudents();
    }, [authStatus]);

    useEffect(() => {
        if (!isFamilyHost) return;
        if (students.length === 0) return;
        if (!selectedStudentId) {
            setSelectedStudentId(students[0].id);
            return;
        }
        const exists = students.some((s) => s.id === selectedStudentId);
        if (!exists) {
            setSelectedStudentId(students[0].id);
        }
    }, [isFamilyHost, students, selectedStudentId]);

    const handleStudentAdded = useCallback((newStudent: Student) => {
        setStudents((prev) => [newStudent, ...prev]); // Prepend new student
        setSelectedStudentId(newStudent.id); // Auto select
        setIsStudentModalOpen(false);
    }, []);

    const handleStudentUpdated = useCallback((updatedStudent: Student) => {
        setStudents((prev) => prev.map((student) => (
            student.id === updatedStudent.id ? updatedStudent : student
        )));
        setSelectedStudentId(updatedStudent.id);
        setIsEditStudentModalOpen(false);
    }, []);

    const handleStudentDeleted = useCallback((deletedStudentId: string) => {
        setStudents((prev) => {
            const nextStudents = prev.filter((student) => student.id !== deletedStudentId);
            const nextSelected = nextStudents[0]?.id || "";
            setSelectedStudentId((current) => current === deletedStudentId ? nextSelected : current);
            return nextStudents;
        });
        setIsEditStudentModalOpen(false);
    }, []);

    const startEditField = (field: "student" | "subject" | "score" | "testDate", value: string) => {
        setFieldError("");
        setEditingField(field);
        setDraftValue(value ?? "");
    };

    const commitEditField = async () => {
        if (!editingField || isSavingField) return;
        if (!analysisId) {
            alert("Analysis ID missing (Transient mode?)");
            setEditingField(null);
            return;
        }

        setIsSavingField(true);
        setFieldError("");
        try {
            if (editingField === "student") {
                const nextStudentId = draftValue;
                if (!nextStudentId) {
                    throw new Error("Student not selected");
                }
                const res = await fetch(`/api/analysis/${analysisId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        studentId: nextStudentId,
                        unitName,
                        testDate,
                        score: Number(result?.test_score ?? 0),
                        subject
                    })
                });
                if (!res.ok) {
                    throw new Error("Failed to update analysis");
                }
                setSelectedStudentId(nextStudentId);
            } else {
                const nextSubject = normalizeSubjectLabel(editingField === "subject" ? draftValue : subject);
                const nextTestDate = editingField === "testDate" ? draftValue : testDate;
                const nextScoreRaw = editingField === "score" ? Number(draftValue) : Number(result?.test_score ?? 0);
                const nextScore = Number.isFinite(nextScoreRaw) ? nextScoreRaw : undefined;

                const res = await fetch(`/api/analysis/${analysisId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        studentId: selectedStudentId,
                        unitName,
                        testDate: nextTestDate,
                        score: nextScore,
                        subject: nextSubject
                    })
                });
                if (!res.ok) {
                    throw new Error("Failed to update analysis");
                }

                if (editingField === "subject") setSubject(nextSubject);
                if (editingField === "testDate") setTestDate(nextTestDate);
                if (editingField === "score") setResult({ ...result, test_score: nextScore });
            }
        } catch (e) {
            console.error(e);
            setFieldError("保存に失敗しました");
        } finally {
            setIsSavingField(false);
            setEditingField(null);
        }
    };

    const handleSubmit = async () => {
        if (!selectedStudentId) {
            alert("Please select a student first.");
            return;
        }
        if (answerSheetFiles.length === 0) {
            alert("Please upload at least one Answer Sheet.");
            return;
        }

        // Reset previous analysis state before new run.
        setResult(null);
        setAnalysisId(null);
        setStatus("uploading");
        setErrorMsg("");

        const formData = new FormData();

        // Append all Answer Sheets
        answerSheetFiles.forEach(file => {
            formData.append("file", file);
        });

        // Append all Problem Sheets
        problemSheetFiles.forEach(file => {
            formData.append("problemSheet", file);
        });

        // Append Context & Student ID
        if (unitName) formData.append("unitName", unitName);
        formData.append("subject", normalizeSubjectLabel(subject));
        formData.append("testDate", testDate);
        formData.append("studentId", selectedStudentId);
        formData.append("examPhase", examPhase ? "true" : "false");

        try {
            // Transition to "analyzing" immediately to show skeleton
            setStatus("analyzing");
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000);

            let res: Response;
            try {
                res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                    signal: controller.signal,
                });
            } finally {
                clearTimeout(timeoutId);
            }

            if (!res.ok) {
                let message = "Upload failed";
                try {
                    const errorData = await res.json();
                    message = errorData.error || errorData.details || message;
                } catch {
                    const text = await res.text();
                    if (text) message = text.slice(0, 300);
                }
                throw new Error(message);
            }

            const data = await res.json();
            console.log("=== ANALYSIS RESPONSE ===", {
                raw_test_score: data?.analysis?.raw_test_score,
                provisional: data?.analysis?.provisional,
                examPhase: data?.analysis?.exam_phase,
            });
            setResult(data.analysis);
            setAnalysisId(data.analysisId); // Capture ID
            setHistoryRefreshKey((prev) => prev + 1);
            setStatus("completed");
        } catch (error: unknown) {
            console.error(error);
            const maybeError = error instanceof Error ? error : null;
            const message =
                maybeError?.name === "AbortError"
                    ? "分析がタイムアウトしました。画像枚数を減らして再実行してください。"
                    : (maybeError?.message || "分析に失敗しました。");
            setErrorMsg(message);
            setStatus("error");
        }
    };

    // Key to force-remount upload areas for deep clearing
    const [resetKey, setResetKey] = useState(0);

    const handleReset = () => {
        setStatus("idle");
        setResult(null);
        setAnswerSheetFiles([]); // Always clear answers

        // Smart Reset: Keep context if locked
        if (!isProblemLocked) {
            setProblemSheetFiles([]);
            setUnitName("");
        }

        setResetKey(prev => prev + 1);
        // Keep selected student for convenience
    };

    const handleClear = () => {
        if (confirm("入力内容をすべてリセットしますか？")) {
            setAnswerSheetFiles([]);
            setProblemSheetFiles([]);
            setUnitName("");
            setResetKey(prev => prev + 1);
        }
    };

    if (authStatus === "loading") return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

    // Device Block Modal
    if (deviceError) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl animate-in zoom-in-95">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">デバイス制限に達しました</h2>
                    <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                        セキュリティ保護のため、1つの組織で使用できる端末は最大2台までに制限されています。<br />
                        別の端末でログインするか、管理者に不要な端末の削除を依頼してください。
                    </p>
                    {deviceErrorCode === "DeviceLimitExceeded" && (
                        <div className="text-left mb-4">
                            <p className="text-xs text-gray-500 font-bold mb-2">登録済みデバイス（解除してこの端末を登録）</p>
                            {blockedDevices.length > 0 ? (
                                <div className="space-y-2">
                                    {blockedDevices.map((d) => (
                                        <div key={d.id} className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-gray-700 truncate">{d.name || "Unknown Device"}</p>
                                                <p className="text-[10px] text-gray-400">
                                                    最終アクティブ: {d.last_active_at ? new Date(d.last_active_at).toLocaleString() : "不明"}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleReplaceDevice(d.id)}
                                                className="text-xs font-bold text-white bg-gray-700 hover:bg-gray-800 px-3 py-1.5 rounded-md"
                                                disabled={isReplacingDevice}
                                            >
                                                この端末に入替
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                                    <p className="text-xs text-gray-500 mb-2">登録済みデバイスを取得中、または取得に失敗しました。</p>
                                    <button
                                        onClick={fetchBlockedDeviceList}
                                        className="text-xs font-bold text-white bg-gray-700 hover:bg-gray-800 px-3 py-1.5 rounded-md"
                                    >
                                        デバイス一覧を再取得
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex flex-col gap-4 mt-4">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            再読み込み
                        </button>
                        <a
                            href={logoutHref}
                            className="text-sm text-gray-500 hover:text-gray-800 underline transition-colors text-center"
                        >
                            ログアウト (トップへ戻る)
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    /* Trial Banner */
    const handleSubscribe = async () => {
        try {
            const res = await fetch("/api/stripe/checkout", { method: "POST" });
            const data = await res.json();
            if (data.url) {
                if (data.setupFeeUrl) {
                    window.open(data.setupFeeUrl, "_blank", "noopener,noreferrer");
                }
                window.location.href = data.url;
            } else {
                const message = data?.error ? `決済・契約が完了できませんでした: ${data.error}` : "決済・契約システムの接続に失敗しました。";
                alert(message);
            }
        } catch (e) {
            console.error("Checkout error", e);
            alert("エラーが発生しました。");
        }
    };

    const trialDaysLeft = trialEndsAt
        ? Math.max(0, Math.ceil((Date.parse(trialEndsAt) - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

    const TrialBanner = () => {
        if (subscriptionStatus === 'active') return null; // HIDE IF ACTIVE

        return (
            <div className="bg-gradient-to-r from-indigo-900 to-purple-900 text-white px-4 py-3 shadow-md mb-6 -mx-4 sm:mx-0 sm:rounded-xl flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-3">
                    <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded shadow-sm">TRIAL</span>
                    <span className="text-sm font-medium">無料トライアル中：残り <span className="font-bold text-yellow-300 text-lg">{trialDaysLeft ?? 14}</span> 日</span>
                </div>
                <button
                    onClick={handleSubscribe}
                    className="text-xs bg-white text-indigo-900 font-bold px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors shadow-sm whitespace-nowrap"
                >
                    本契約へ進む (Stripe)
                </button>
            </div>
        );
    };

    const isTrialExpired = isDeviceVerified
        && (subscriptionStatus === "trialing" || subscriptionStatus === "trial")
        && !!trialEndsAt
        && Date.now() > Date.parse(trialEndsAt as string);
    const selectedStudent = students.find((s) => s.id === selectedStudentId) ?? (isFamilyHost ? students[0] : undefined);
    const effectiveStudentId = selectedStudentId || (isFamilyHost ? (students[0]?.id || "") : "");
    const canOpenHistory = isFamilyHost ? !!effectiveStudentId : !!selectedStudentId;

    if (isTrialExpired) {
        return <TrialExpiredGate onSubscribe={handleSubscribe} />;
    }

    // examBlocked: single source of truth for "evaluation unavailable" in exam mode.
    const examBlocked = !!(result?.exam_phase && result?.provisional && !result?.raw_test_score);
    const coveredTopics = Array.isArray(result?.covered_topics)
        ? result.covered_topics.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        : [];
    const reviewFocuses = result
        ? (Array.isArray(result.review_focuses) && result.review_focuses.length > 0
            ? result.review_focuses
            : summarizeReviewFocus({
                subject,
                unitName,
                coveredTopics,
                wrongQuestionTopics: Array.isArray(result.wrong_question_topics) ? result.wrong_question_topics : [],
                questionMistakes: Array.isArray(result.question_mistakes) ? result.question_mistakes : [],
                weaknessAreas: Array.isArray(result.weakness_areas) ? result.weakness_areas : [],
            }))
        : [];

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <TrialBanner />
            <header className="mb-10 text-center">
                <div className="mb-4 flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                    <a
                        href="/legal/manual"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-blue-600 font-medium transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        マニュアル
                    </a>
                    <a
                        href="/settings"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-blue-600 font-medium transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0a1 1 0 00.95.69h.7c.969 0 1.371 1.24.588 1.81a1 1 0 00-.364 1.118l.22.68c.3.921-.755 1.688-1.54 1.118a1 1 0 00-1.175 0l-.56.4a1 1 0 01-1.175 0l-.56-.4a1 1 0 00-1.175 0c-.784.57-1.838-.197-1.539-1.118l.22-.68a1 1 0 00-.364-1.118c-.783-.57-.38-1.81.588-1.81h.7a1 1 0 00.95-.69z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15a3 3 0 100-6 3 3 0 000 6z" /></svg>
                        設定
                    </a>
                    <a
                        href={logoutHref}
                        className="inline-flex items-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold px-3 py-1.5 text-xs transition-colors"
                    >
                        ログアウト
                    </a>
                </div>

                <div className="mx-auto relative w-64 h-auto mb-2 mt-4 sm:mt-8">
                    <img
                        src="/images/logo.png"
                        alt="TENsNAP・Omni"
                        className="w-full h-auto object-contain"
                    />
                </div>
                <p className="text-gray-500 mt-2 text-sm font-medium tracking-wide font-sans">
                    学習理解度を可視化・指導を改善する分析支援システム
                </p>
            </header>

            <StudentSelector
                selectedStudentId={selectedStudentId}
                onSelect={setSelectedStudentId}
                onOpenModal={() => {
                    if (!isFamilyHost) {
                        setIsStudentModalOpen(true);
                    }
                }}
                onOpenEditModal={() => setIsEditStudentModalOpen(true)}
                students={students}
                canAddStudent={!isFamilyHost}
                canEditStudent={!!selectedStudent}
            />

            {/* History Toggle & Timeline */}
            <div className="mb-8 animate-in fade-in slide-in-from-top-1 duration-300">
                <button
                    onClick={() => {
                        if (canOpenHistory) {
                            setShowHistory(!showHistory);
                        }
                    }}
                    disabled={!canOpenHistory}
                    className={`
                        w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all
                        ${canOpenHistory
                            ? 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 hover:shadow-sm cursor-pointer'
                            : 'bg-gray-100 text-gray-400 border border-transparent cursor-not-allowed'}
                    `}
                >
                    <span>📊</span>
                    {canOpenHistory
                        ? (showHistory ? "履歴を閉じる" : (isFamilyHost ? "お子さまの分析履歴を見る" : "この生徒の分析履歴を見る"))
                        : "生徒を選択すると履歴が見れます"}
                </button>

                {showHistory && canOpenHistory && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-blue-100 shadow-inner bg-gray-50 animate-in slide-in-from-top-2">
                        <HistoryErrorBoundary>
                            <StudentHistory
                                studentId={effectiveStudentId}
                                studentName={students.find(s => s.id === effectiveStudentId)?.name || students[0]?.name || (isFamilyHost ? "お子さま" : "生徒")}
                                targetSchool={students.find(s => s.id === effectiveStudentId)?.target_school || students[0]?.target_school || ""}
                                refreshKey={historyRefreshKey}
                            />
                        </HistoryErrorBoundary>
                    </div>
                )}
            </div>

            {/* Registration Modal */}
            {!isFamilyHost && (
                <AddStudentModal
                    isOpen={isStudentModalOpen}
                    onClose={() => setIsStudentModalOpen(false)}
                    onAdded={handleStudentAdded}
                />
            )}
            <AddStudentModal
                isOpen={isEditStudentModalOpen}
                onClose={() => setIsEditStudentModalOpen(false)}
                onAdded={handleStudentAdded}
                mode="edit"
                initialStudent={selectedStudent ?? null}
                onUpdated={handleStudentUpdated}
                onDeleted={!isFamilyHost ? handleStudentDeleted : undefined}
            />

            {/* Main Upload / Results Area */}
            {(status === "idle" || status === "uploading" || status === "analyzing" || status === "error") && (
                <>
                    <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* Left Column: Context & Problem Sheets */}
                        <div className="space-y-6">
                            <section>
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    前提情報（単元・科目など）
                                </h3>
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">教科</label>
                                        <select
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            {subjectOptions.map((s) => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="min-w-0">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">実施日</label>
                                        <input
                                            type="date"
                                            value={testDate}
                                            onChange={(e) => setTestDate(e.target.value)}
                                            className="block w-full max-w-full min-w-0 box-border px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white text-left focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:light] [appearance:none] [-webkit-appearance:none]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">単元名 / 科目詳細</label>
                                        <input
                                            type="text"
                                            value={unitName}
                                            onChange={(e) => setUnitName(e.target.value)}
                                            placeholder="例: 一次関数、英語 長文読解など"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                        <div>
                                            <p className="text-xs font-bold text-gray-700">受験期モード（講師用）</p>
                                            <p className="text-[11px] text-gray-500">結果重視の評価に切り替えます</p>
                                        </div>
                                        <label className="inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={examPhase}
                                                onChange={(e) => setExamPhase(e.target.checked)}
                                                className="sr-only"
                                            />
                                            <span className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${examPhase ? "bg-blue-600" : "bg-gray-300"}`}>
                                                <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${examPhase ? "translate-x-5" : "translate-x-0"}`} />
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        1. 問題用紙 (任意)
                                    </h3>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`
                                        w-4 h-4 rounded border flex items-center justify-center transition-colors
                                        ${isProblemLocked ? 'bg-blue-600 border-blue-600' : 'border-gray-400 group-hover:border-blue-500'}
                                    `}>
                                            <input
                                                type="checkbox"
                                                checked={isProblemLocked}
                                                onChange={(e) => setIsProblemLocked(e.target.checked)}
                                                className="hidden"
                                            />
                                            {isProblemLocked && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                        <span className={`text-xs font-bold transition-colors ${isProblemLocked ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'}`}>
                                            {isProblemLocked ? '固定中 (連続スキャン)' : '固定する'}
                                        </span>
                                    </label>
                                </div>
                                <p className="text-[10px] text-red-500 mb-2 font-bold">
                                    ※10枚以上アップロードする場合、10枚ずつ足してください
                                </p>
                                <div className={`bg-white p-4 rounded-xl border shadow-sm transition-colors ${isProblemLocked ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'}`}>
                                    {isProblemLocked ? (
                                        <div className="text-center py-8">
                                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                            </div>
                                            <p className="text-sm font-bold text-gray-700">問題用紙を固定中</p>
                                            <p className="text-xs text-gray-500 mt-1">{problemSheetFiles.length} 枚の画像が次のスキャンにも適用されます</p>
                                            <button
                                                onClick={() => setIsProblemLocked(false)}
                                                className="text-xs text-blue-600 underline mt-2 hover:text-blue-800"
                                            >
                                                固定を解除して変更
                                            </button>
                                        </div>
                                    ) : (
                                        <MultiUploadArea
                                            key={`problems-${resetKey}`}
                                            onFilesChange={setProblemSheetFiles}
                                            title="問題用紙をドロップ"
                                            subTitle="問題文 / 模範解答画像"
                                        />
                                    )}
                                </div>
                            </section>
                        </div>

                        {/* Right Column: Answer Sheets (Main) */}
                        <div className="space-y-6">
                            <section className="h-full flex flex-col">
                                <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    2. 生徒の答案 (必須)
                                </h3>
                                <div className="bg-blue-50/50 p-4 rounded-xl border-2 border-blue-100 flex-1 flex flex-col justify-between">
                                    <MultiUploadArea
                                        key={`answers-${resetKey}`}
                                        onFilesChange={setAnswerSheetFiles}
                                        title="答案用紙をドロップ"
                                        subTitle="生徒が解いた答案画像"
                                    />

                                    <div className="mt-8 space-y-3">
                                        <button
                                            onClick={handleSubmit}
                                            disabled={answerSheetFiles.length === 0}
                                            className={`
                                                w-full py-3.5 px-4 rounded-xl font-bold text-white shadow-md transition-all
                                                ${answerSheetFiles.length > 0
                                                    ? "bg-[#3b82f6] hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                                                    : "bg-[#3b82f680] cursor-not-allowed"
                                                }
                                            `}
                                        >
                                            採点・分析を開始
                                        </button>

                                        <div className="flex justify-center items-center px-1">
                                            <p className="text-xs text-gray-400">
                                                {answerSheetFiles.length > 0 ? `${answerSheetFiles.length} 枚のスキャン待ち` : "画像をアップロードしてください"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* Clear Button (Centered below grid) */}
                    {(answerSheetFiles.length > 0 || problemSheetFiles.length > 0 || unitName) && (
                        <div className="mt-8 text-center animate-in fade-in slide-in-from-top-2">
                            <button
                                onClick={handleClear}
                                className="text-sm text-gray-400 hover:text-red-500 font-medium transition-colors flex items-center justify-center gap-2 mx-auto px-4 py-2 rounded-lg hover:bg-red-50"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                入力内容をすべてリセット (画像・テキスト)
                            </button>
                        </div>
                    )}
                </>
            )}

            {(status === "uploading" || status === "analyzing") && (
                <AnalysisStatus status={status} />
            )}

            {status === "error" && (
                <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p className="font-bold mb-1">分析中にエラーが発生しました</p>
                    <p>{errorMsg || "時間をおいて再実行してください。"}</p>
                </div>
            )}

            {status === "completed" && result && (
                <div className="w-full bg-white rounded-lg shadow-lg p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center mb-6">
                        <h2 className="text-xl font-bold text-gray-700 tracking-wider">分析結果</h2>

                        {/* Score Overview (Test Score Removed) */}
                        <div className="flex items-center justify-center mt-6">
                            {/* Total Comprehension */}
                            <div className="text-center">
                                <span className="block text-sm font-bold text-blue-600 mb-2">学習理解度</span>
                                <div className={`text-6xl font-extrabold leading-none ${examBlocked ? "text-gray-300" : "text-blue-600"}`}>
                                    {examBlocked ? "—" : result.comprehension_score}
                                    {!examBlocked && <span className="text-2xl font-bold text-blue-400 ml-1">%</span>}
                                </div>
                                <p className="text-xs text-gray-400 mt-2 font-medium">総合的な習得状態</p>
                            </div>
                        </div>
                        {(result?.exam_phase === true || result?.test_score_raw !== undefined) && (
                            <div className="mt-3 flex flex-col items-center gap-2">
                                {result?.exam_phase === true && (
                                    <span className="inline-flex items-center gap-2 rounded-full bg-red-50 text-red-600 text-[11px] font-bold px-3 py-1 border border-red-200">
                                        受験期モードON
                                    </span>
                                )}
                                {result?.test_score_raw !== undefined && (
                                    <p className="text-[11px] text-gray-500">
                                        評価対象得点：{String(result.test_score_raw)}（この数値をもとに理解度を算出しています）
                                    </p>
                                )}
                            </div>
                        )}
                        {examBlocked && (
                            <p className="mt-3 text-xs text-red-500 font-semibold">
                                ⚠ 評価不能（受験期モードでは答案からの得点検出が必須です）
                            </p>
                        )}

                        {/* Weighted Breakdown */}
                        {result.comprehension_details && (
                            <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 max-w-3xl mx-auto ${examBlocked ? "opacity-40 grayscale" : ""}`}>
                                <div className="bg-gray-50 p-3 rounded-lg text-center border border-gray-100">
                                    <span className="block text-[11px] text-gray-500 font-bold mb-1">得点理解度</span>
                                    <span className="text-xl font-bold text-gray-800">{examBlocked ? "—" : `${result.comprehension_details.accuracy}%`}</span>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg text-center border border-gray-100">
                                    <span className="block text-[11px] text-gray-500 font-bold mb-1">設問安定度</span>
                                    <span className="text-xl font-bold text-gray-800">{examBlocked ? "—" : `${result.comprehension_details.question_accuracy ?? result.comprehension_details.accuracy}%`}</span>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg text-center border border-gray-100">
                                    <span className="block text-[11px] text-gray-500 font-bold mb-1">思考・記述プロセス</span>
                                    <span className="text-xl font-bold text-gray-800">{examBlocked ? "—" : `${result.comprehension_details.process}%`}</span>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg text-center border border-gray-100">
                                    <span className="block text-[11px] text-gray-500 font-bold mb-1">学習の安定感</span>
                                    <span className="text-xl font-bold text-gray-800">{examBlocked ? "—" : `${result.comprehension_details.consistency}%`}</span>
                                </div>
                            </div>
                        )}
                        {result.comprehension_details && (
                            <div className="mt-3 text-center space-y-1">
                                {typeof result.comprehension_details.question_accuracy === "number" &&
                                    result.comprehension_details.question_accuracy < result.comprehension_details.accuracy && (
                                        <p className="text-[11px] text-gray-500">
                                            ※ 設問ごとの安定度が低いため、得点に比べ理解度が抑えられています
                                        </p>
                                    )}
                                {result.provisional === true && (
                                    <p className="text-[11px] text-gray-500">
                                        ※ 得点情報が未取得のため、理解度は暫定評価です
                                    </p>
                                )}
                            </div>
                        )}
                        <div className="mt-4 mx-auto max-w-md text-[11px] text-gray-400 border-t border-gray-100 pt-3 text-left">
                            <div className="font-semibold text-gray-500 mb-1">採点条件:</div>
                            <div>・raw得点: {result?.raw_test_score ? String(result.raw_test_score) : "—"}</div>
                            <div>・input得点: {result?.input_test_score ? String(result.input_test_score) : "—"}</div>
                            <div>・受験期モード: {result?.exam_phase ? "ON" : "OFF"}</div>
                            <div>・評価区分: {result?.provisional ? "暫定" : "確定"}</div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Topic-focused Insights */}
                        <div className="bg-blue-50 rounded-lg border border-blue-100 p-6">
                            <span className="block text-blue-700 text-xs font-bold mb-4 tracking-wide">単元別分析インサイト</span>
                            <p className="text-xs text-gray-500 mb-3">
                                設問ごとの正誤ではなく、今回の答案から抽出した学習単元を表示しています。
                            </p>
                            <div className="flex flex-wrap gap-2 mb-5">
                                {(coveredTopics.length > 0 ? coveredTopics : ["単元の抽出データなし"]).map((topic: string, i: number) => (
                                    <span key={i} className="bg-white border border-blue-200 text-gray-700 text-xs px-3 py-1.5 rounded-full font-semibold shadow-sm">
                                        {topic}
                                    </span>
                                ))}
                            </div>

                            {/* Conclusion */}
                            {result.insight_conclusion && (
                                <div className="bg-white/80 p-4 rounded-lg border border-blue-100 shadow-sm">
                                    <p className="text-sm font-bold text-gray-800 leading-relaxed">
                                        <span className="mr-2">💡</span> {result.insight_conclusion}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Inline Editable Metadata */}
                        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-gray-600 tracking-wide">リザルト基本情報</h3>
                                {fieldError && <span className="text-xs text-red-500">{fieldError}</span>}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Student Name */}
                                <div className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
                                    <div className="w-full">
                                        <span className="block text-[11px] text-gray-500 font-bold mb-1">{isFamilyHost ? "お子さま" : "生徒名"}</span>
                                        {editingField === "student" && !isFamilyHost ? (
                                            <select
                                                autoFocus
                                                value={draftValue}
                                                onChange={(e) => setDraftValue(e.target.value)}
                                                onBlur={commitEditField}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        commitEditField();
                                                    }
                                                }}
                                                className="w-full text-sm border border-blue-300 bg-blue-50 rounded-md px-2 py-1 outline-none"
                                            >
                                                <option value="">(生徒を選択)</option>
                                                {students.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className="text-sm font-semibold text-gray-800">
                                                {students.find(s => s.id === selectedStudentId)?.name || students[0]?.name || (isFamilyHost ? "お子さま" : "生徒")}
                                            </span>
                                        )}
                                    </div>
                                    {!isFamilyHost && (
                                        <button
                                            onClick={() => startEditField("student", selectedStudentId)}
                                            className="text-xs text-gray-500 hover:text-blue-600"
                                            disabled={isSavingField}
                                        >
                                            ✏️
                                        </button>
                                    )}
                                </div>

                                {/* Subject */}
                                <div className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
                                    <div className="w-full">
                                        <span className="block text-[11px] text-gray-500 font-bold mb-1">教科</span>
                                        {editingField === "subject" ? (
                                            <select
                                                autoFocus
                                                value={draftValue}
                                                onChange={(e) => setDraftValue(e.target.value)}
                                                onBlur={commitEditField}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        commitEditField();
                                                    }
                                                }}
                                                className="w-full text-sm border border-blue-300 bg-blue-50 rounded-md px-2 py-1 outline-none"
                                            >
                                                {subjectOptions.map(s => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className="text-sm font-semibold text-gray-800">{normalizeSubjectLabel(subject)}</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => startEditField("subject", normalizeSubjectLabel(subject))}
                                        className="text-xs text-gray-500 hover:text-blue-600"
                                        disabled={isSavingField}
                                    >
                                        ✏️
                                    </button>
                                </div>

                                {/* Score */}
                                <div className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
                                    <div>
                                        <span className="block text-[11px] text-gray-500 font-bold mb-1">スコア</span>
                                        {editingField === "score" ? (
                                            <input
                                                autoFocus
                                                type="number"
                                                value={draftValue}
                                                onChange={(e) => setDraftValue(e.target.value)}
                                                onBlur={commitEditField}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        commitEditField();
                                                    }
                                                }}
                                                className="w-full text-sm border border-blue-300 bg-blue-50 rounded-md px-2 py-1 outline-none"
                                            />
                                        ) : (
                                            <span className="text-sm font-semibold text-gray-800">
                                                {examBlocked ? "—" : (result.test_score ?? 0)}
                                            </span>
                                        )}
                                        {/* examBlocked: hide score artifacts to avoid "evaluated" confusion */}
                                        {!examBlocked && result?.test_score_raw !== undefined && (
                                            <p className="text-[10px] text-gray-400 mt-0.5">
                                                raw: {String(result.test_score_raw)}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => startEditField("score", String(result.test_score ?? 0))}
                                        className="text-xs text-gray-500 hover:text-blue-600"
                                        disabled={isSavingField}
                                    >
                                        ✏️
                                    </button>
                                </div>

                                {/* Test Date */}
                                <div className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
                                    <div>
                                        <span className="block text-[11px] text-gray-500 font-bold mb-1">実施日</span>
                                        {editingField === "testDate" ? (
                                            <input
                                                autoFocus
                                                type="date"
                                                value={draftValue}
                                                onChange={(e) => setDraftValue(e.target.value)}
                                                onBlur={commitEditField}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        commitEditField();
                                                    }
                                                }}
                                                className="w-full min-w-0 text-sm text-gray-900 border border-blue-300 bg-blue-50 rounded-md px-2 py-1 outline-none [color-scheme:light]"
                                            />
                                        ) : (
                                            <span className="text-sm font-semibold text-gray-800">{testDate}</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => startEditField("testDate", testDate)}
                                        className="text-xs text-gray-500 hover:text-blue-600"
                                        disabled={isSavingField}
                                    >
                                        ✏️
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Weakness Areas (Prioritized) */}
                        {(result.weakness_areas ?? []).length > 0 && (
                            <div className="p-5 bg-red-50 rounded-lg border border-red-100">
                                <span className="block text-red-600 text-xs font-bold mb-3 tracking-wide">重点克服分野</span>
                                <div className="flex flex-col gap-3">
                                    {(result.weakness_areas ?? []).map((w: WeaknessArea, i: number) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded text-white shadow-sm min-w-[60px] text-center ${w.level === 'Primary' ? 'bg-red-500' : 'bg-orange-400'
                                                }`}>
                                                {w.level === 'Primary' ? '最優先' : '関連課題'}
                                            </span>
                                            <span className="text-sm font-bold text-gray-700">{w.topic}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {reviewFocuses.length > 0 && (
                            <div className="p-5 bg-amber-50 rounded-lg border border-amber-100">
                                <span className="block text-amber-700 text-xs font-bold mb-3 tracking-wide">{getReviewFocusTitle(subject)}</span>
                                <div className="flex flex-wrap gap-2">
                                    {reviewFocuses.map((topic, i) => (
                                        <span key={i} className="bg-white border border-amber-200 text-gray-700 text-xs px-3 py-1.5 rounded-full font-semibold shadow-sm">
                                            {topic}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Disclaimer */}
                        <div className="text-center mt-6 p-2">
                            <p className="text-[10px] text-gray-400 font-medium">
                                {result.disclaimer ?? "本分析は複数の設問傾向から推定した学習状態です。"}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4 mt-8">
                        <button
                            onClick={handleReset}
                            className="flex-1 bg-gray-900 text-white py-4 px-6 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg hover:translate-y-[-1px]"
                        >
                            トップへ戻る (次の分析)
                        </button>
                        <button
                            onClick={() => setShowHistory(true)}
                            className="flex-1 bg-white text-blue-600 border-2 border-blue-100 py-4 px-6 rounded-xl font-bold hover:bg-blue-50 transition-all shadow-sm"
                        >
                            生徒の履歴を見る
                        </button>
                    </div>
                </div>
            )}

            <NewsTicker />
        </div>
    );
}
