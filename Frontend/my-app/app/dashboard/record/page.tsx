"use client";

import DashboardLayout from "../../../components/Layout/DashboardLayout";
import MeetingRecord from "../../../components/Dashboard/MeetingRecord";
import ErrorBoundary from "../../../components/Dashboard/ErrorBoundary";

export default function RecordPage() {
    return (
        <DashboardLayout>
            <ErrorBoundary>
                <MeetingRecord />
            </ErrorBoundary>
        </DashboardLayout>
    );
}
