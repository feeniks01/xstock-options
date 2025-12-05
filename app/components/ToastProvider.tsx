"use client";

import { Toaster } from "react-hot-toast";

export default function ToastProvider() {
    return (
        <Toaster
            position="bottom-right"
            toastOptions={{
                duration: 4000,
                style: {
                    background: "#1a1b20",
                    color: "#f5f5f5",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    padding: "12px 16px",
                },
                success: {
                    iconTheme: {
                        primary: "#3DD68C",
                        secondary: "#1a1b20",
                    },
                },
                error: {
                    iconTheme: {
                        primary: "#FF5C5C",
                        secondary: "#1a1b20",
                    },
                    duration: 5000,
                },
            }}
        />
    );
}
