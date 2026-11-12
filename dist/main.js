"use strict";
const CONFIG = {
    EVENT_NAME: "14th Installation Ceremony of Rotaract Club of Uva Wellassa University- Badulla",
    ENDPOINT_URL: "https://rac-form-api.rac-uwu.workers.dev/submit",
};
function getElement(id) {
    const el = document.getElementById(id);
    if (!el) {
        throw new Error(`Missing required element #${id}`);
    }
    return el;
}
const form = getElement("attendance-form");
const submitBtn = getElement("submit-btn");
const btnText = submitBtn.querySelector(".btn-text");
const btnSpinner = submitBtn.querySelector(".btn-spinner");
const formAlert = getElement("form-alert");
const formScreen = getElement("form-screen");
const thankYouScreen = getElement("thank-you-screen");
const submittedSummary = getElement("submitted-summary");
const resetBtn = document.getElementById("reset-btn");
const stepperFill = getElement("stepper-fill");
const errorModal = getElement("error-modal");
const modalRetryBtn = getElement("modal-retry-btn");
const modalCancelBtn = getElement("modal-cancel-btn");
const modalErrMessage = getElement("modal-err-message");
let lastFailedPayload = null;
const stepNodes = [
    getElement("step-node-0"),
    getElement("step-node-1"),
    getElement("step-node-2"),
    getElement("step-node-3"),
];
const fields = {
    fullName: {
        input: getElement("fullName"),
        error: getElement("fullName-error"),
        index: 0,
        validate(value) {
            if (!value)
                return "Please enter your full name.";
            if (value.length < 3)
                return "Name must be at least 3 characters.";
            // Allow letters, dots, spaces, hyphens, and apostrophes (standard Sri Lankan name format)
            if (!/^[A-Za-z\s.'-]+$/.test(value)) {
                return "Please enter a valid name (e.g. G . Ravindu Sankalpa).";
            }
            return "";
        },
    },
    enrollmentNumber: {
        input: getElement("enrollmentNumber"),
        error: getElement("enrollmentNumber-error"),
        index: 1,
        validate(value) {
            if (!value)
                return "Please enter your enrollment number.";
            // Uva Wellassa University format: UWU/DEGREE/YY/NUM (e.g. UWU/CST/21/001 or UWU/XXX/XX/XX)
            const pattern = /^UWU\/[A-Za-z]{2,5}\/\d{2}\/\d{2,4}$/i;
            if (!pattern.test(value.trim())) {
                return "Invalid format. Expected: UWU/XXX/XX/XX (e.g. UWU/CST/21/001).";
            }
            return "";
        },
    },
    contactNumber: {
        input: getElement("contactNumber"),
        error: getElement("contactNumber-error"),
        index: 2,
        validate(value) {
            if (!value)
                return "Please enter your contact number.";
            // Sri Lankan mobile number: starts with 07X followed by 7 digits, or +947X / 947X
            const cleaned = value.replace(/[\s-]/g, "");
            const slMobilePattern = /^(?:0|(?:\+?94))?7[0-2,4-8]\d{7}$/;
            if (!slMobilePattern.test(cleaned)) {
                return "Please enter a valid Sri Lankan phone number (e.g. 0784567654).";
            }
            return "";
        },
    },
    nicNumber: {
        input: getElement("nicNumber"),
        error: getElement("nicNumber-error"),
        index: 3,
        validate(value) {
            if (!value)
                return "Please enter your NIC number.";
            const cleaned = value.replace(/\s/g, "");
            // Sri Lankan Old NIC: 9 digits + V/X (e.g. 991234567V)
            // Sri Lankan New NIC: 12 digits (e.g. 200123444666)
            const oldNicPattern = /^\d{9}[VvXx]$/;
            const newNicPattern = /^(?:19|20)\d{10}$/;
            if (!oldNicPattern.test(cleaned) && !newNicPattern.test(cleaned)) {
                return "Please enter a valid Sri Lankan NIC (e.g. 200123444666 or 991234567V).";
            }
            return "";
        },
    },
};
const fieldKeys = ["fullName", "enrollmentNumber", "contactNumber", "nicNumber"];
/**
 * Updates the filling progress bar and 4 circle nodes dynamically
 * based on whether each input has valid non-empty content.
 */
function updateProgressAnimation() {
    let filledCount = 0;
    const isFilled = [false, false, false, false];
    fieldKeys.forEach((key, idx) => {
        const val = fields[key].input.value.trim();
        // A step is considered filled if user entered text (ignoring minor format errors while typing)
        if (val.length > 0) {
            isFilled[idx] = true;
            filledCount++;
        }
    });
    // Calculate the bar fill percentage connecting the 4 circles (0% to 100%)
    // Find the highest step filled so far
    let highestStep = -1;
    for (let i = 3; i >= 0; i--) {
        if (isFilled[i]) {
            highestStep = i;
            break;
        }
    }
    // Set line fill percentage: step 0 -> 0%, step 1 -> 33.3%, step 2 -> 66.6%, step 3 -> 100%
    let fillPercent = 0;
    if (highestStep === 0)
        fillPercent = 0;
    else if (highestStep === 1)
        fillPercent = 33.33;
    else if (highestStep === 2)
        fillPercent = 66.66;
    else if (highestStep === 3)
        fillPercent = 100;
    stepperFill.style.width = `${fillPercent}%`;
    stepNodes.forEach((node, idx) => {
        const wasFilled = node.classList.contains("filled");
        const nowFilled = isFilled[idx];
        node.classList.toggle("filled", nowFilled);
        // Never prefill or add active class unless the user actually typed in the field
        node.classList.remove("active");
        if (!wasFilled && nowFilled) {
            node.classList.add("just-filled");
            setTimeout(() => node.classList.remove("just-filled"), 350);
        }
    });
}
function setFieldError(key, message) {
    const { input, error } = fields[key];
    error.textContent = message;
    input.classList.toggle("invalid", Boolean(message));
}
function showAlert(message) {
    formAlert.textContent = message;
    formAlert.classList.remove("hidden");
}
function hideAlert() {
    formAlert.textContent = "";
    formAlert.classList.add("hidden");
}
function showErrorModal(message) {
    if (message) {
        modalErrMessage.textContent = message;
    }
    else {
        modalErrMessage.textContent =
            "We couldn’t reach the server. Don’t worry, your entered details are safe. Please check your internet connection and try again.";
    }
    errorModal.classList.remove("hidden");
}
function hideErrorModal() {
    errorModal.classList.add("hidden");
}
function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    btnText.textContent = isLoading ? "Submitting..." : "Submit";
    btnSpinner.classList.toggle("hidden", !isLoading);
}
// Live typing listeners: update error states and animate progress bar
fieldKeys.forEach((key) => {
    const { input, error } = fields[key];
    input.addEventListener("input", () => {
        if (error.textContent) {
            // Clear error immediately if typing
            setFieldError(key, "");
        }
        updateProgressAnimation();
    });
    input.addEventListener("blur", () => {
        const value = input.value.trim();
        if (value) {
            const err = fields[key].validate(value);
            setFieldError(key, err);
        }
        updateProgressAnimation();
    });
});
function validateAll() {
    let valid = true;
    const values = {};
    fieldKeys.forEach((key) => {
        const value = fields[key].input.value.trim();
        const errorMsg = fields[key].validate(value);
        setFieldError(key, errorMsg);
        if (errorMsg)
            valid = false;
        values[key] = value;
    });
    updateProgressAnimation();
    return { valid, values };
}
function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
function showSuccess(values) {
    submittedSummary.innerHTML = `
    <div><span>Full Name</span><span>${escapeHtml(values.fullName)}</span></div>
    <div><span>Enrollment No</span><span>${escapeHtml(values.enrollmentNumber)}</span></div>
    <div><span>Contact No</span><span>${escapeHtml(values.contactNumber)}</span></div>
    <div><span>NIC No</span><span>${escapeHtml(values.nicNumber)}</span></div>
  `;
    formScreen.classList.add("hidden");
    thankYouScreen.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}
async function submitWithRetry(url, payload, retries = 2) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            // If the backend says duplicate (409 Conflict), don't retry, throw custom error
            if (response.status === 409) {
                const data = await response.json().catch(() => ({ error: "Already registered." }));
                const err = new Error(data.error || "This Enrollment Number or NIC has already been registered.");
                err.isDuplicate = true;
                throw err;
            }
            if (!response.ok) {
                const text = await response.text().catch(() => "");
                throw new Error(text || `Server responded with ${response.status}`);
            }
            return await response.json();
        }
        catch (err) {
            lastError = err;
            // Do not retry if it's an explicit duplicate conflict
            if (err.isDuplicate) {
                throw err;
            }
            if (attempt < retries) {
                await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
            }
        }
    }
    throw lastError;
}
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert();
    const { valid, values } = validateAll();
    if (!valid)
        return;
    setLoading(true);
    const payload = {
        eventName: CONFIG.EVENT_NAME,
        fullName: values.fullName,
        enrollmentNumber: values.enrollmentNumber.toUpperCase(),
        contactNumber: values.contactNumber,
        nicNumber: values.nicNumber.toUpperCase(),
        submittedAt: new Date().toISOString(),
    };
    try {
        if (!CONFIG.ENDPOINT_URL) {
            // Local preview mode
            console.info("Local demo mode (no ENDPOINT_URL). Payload:", payload);
            await new Promise((r) => setTimeout(r, 400));
        }
        else {
            await submitWithRetry(CONFIG.ENDPOINT_URL, payload);
        }
        showSuccess(payload);
    }
    catch (err) {
        console.error("Submission failed:", err);
        const isDup = Boolean(err?.isDuplicate);
        const message = err?.message || "Could not record your attendance. Please check your internet connection.";
        if (isDup) {
            // Show directly on the form so user can see which field conflicted
            showAlert(message);
            if (message.toLowerCase().includes("enrollment")) {
                setFieldError("enrollmentNumber", message);
                fields.enrollmentNumber.input.focus();
            }
            else if (message.toLowerCase().includes("nic")) {
                setFieldError("nicNumber", message);
                fields.nicNumber.input.focus();
            }
        }
        else {
            lastFailedPayload = payload;
            showErrorModal("Could not record your attendance. Please check your internet connection and tap Try Again.");
        }
    }
    finally {
        setLoading(false);
    }
});
modalRetryBtn.addEventListener("click", async () => {
    if (!lastFailedPayload) {
        hideErrorModal();
        return;
    }
    hideErrorModal();
    setLoading(true);
    try {
        if (!CONFIG.ENDPOINT_URL) {
            await new Promise((r) => setTimeout(r, 400));
        }
        else {
            await submitWithRetry(CONFIG.ENDPOINT_URL, lastFailedPayload);
        }
        showSuccess(lastFailedPayload);
        lastFailedPayload = null;
    }
    catch (err) {
        console.error("Retry failed:", err);
        showErrorModal("Retry attempt failed. Please check your data connection and try again.");
    }
    finally {
        setLoading(false);
    }
});
modalCancelBtn.addEventListener("click", () => {
    hideErrorModal();
});
if (resetBtn) {
    resetBtn.addEventListener("click", () => {
        form.reset();
        hideAlert();
        fieldKeys.forEach((key) => setFieldError(key, ""));
        updateProgressAnimation();
        thankYouScreen.classList.add("hidden");
        formScreen.classList.remove("hidden");
        fields.fullName.input.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}
// Initialize on page load
updateProgressAnimation();
