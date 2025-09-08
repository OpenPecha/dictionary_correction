// Original function for complex pay calculation
export const calculatePayByGroup = (groupID, reviewedSecs, syllableCount, reviewedCount) => {
    const stt_ab_groups = [1, 2, 7];
    groupID = Number(groupID)
    if (stt_ab_groups.includes(groupID)) {
        return ((reviewedSecs / 60) * 5 + reviewedCount * 2).toFixed(2);
    }
    else {
        return ((reviewedSecs / 60) * 5 + syllableCount * 0.4).toFixed(2);
    }
};

// Simple role-based pay calculation function for tests
export const calculatePay = (taskCount, role) => {
    // Handle edge cases
    if (!taskCount || taskCount < 0) {
        return 0;
    }
    
    if (!role) {
        return 0;
    }

    // Floor decimal task counts
    const tasks = Math.floor(taskCount);
    
    // Role-based payment rates
    const rates = {
        'TRANSCRIBER': 5,
        'REVIEWER': 4, 
        'FINAL_REVIEWER': 6
    };
    
    const rate = rates[role];
    if (!rate) {
        return 0; // Unknown role
    }
    
    return tasks * rate;
};

// Export as default for backwards compatibility
export default calculatePay;
