
#include "Models.h"

#include <chrono>
#include <ctime>
#include <iomanip>
#include <random>
#include <sstream>

namespace ease {
namespace models {

// Generate a simple unique ID.
std::string generateId() {
    static std::mt19937 generator(std::random_device{}());
    static const char* digits = "0123456789abcdef";

    std::string id;

    for (int i = 0; i < 32; i++)
        id += digits[generator() % 16];

    return id;
}

// Get current UTC time.
std::string utcNow() {
    auto now = std::chrono::system_clock::now();
    std::time_t time = std::chrono::system_clock::to_time_t(now);

    std::tm utc{};

#ifdef _WIN32
    gmtime_s(&utc, &time);
#else
    gmtime_r(&time, &utc);
#endif

    std::ostringstream result;
    result << std::put_time(&utc, "%Y-%m-%dT%H:%M:%SZ");

    return result.str();
}

// Check emergency report input.
bool validateReportCreate(const ReportCreate& data) {
    return data.text.size() >= 5 &&
           data.text.size() <= 2000 &&
           (data.urgency == "life" ||
            data.urgency == "urgent" ||
            data.urgency == "info");
}

// Check reply input.
bool validateReplyCreate(const ReplyCreate& data) {
    return !data.text.empty() && data.text.size() <= 500;
}

// Check operational note.
bool validateNoteBody(const NoteBody& data) {
    return !data.text.empty() && data.text.size() <= 500;
}

// Check citizen registration.
bool validateCitizenRegister(const CitizenRegister& data) {
    return data.name.size() >= 2 &&
           data.name.size() <= 80 &&
           data.password.size() >= 8 &&
           data.password.size() <= 128;
}

// Check OTP request.
bool validateOtpIssue(const OtpIssue& data) {
    return data.name.size() >= 2 &&
           data.name.size() <= 80 &&
           data.password.size() >= 8 &&
           data.password.size() <= 128;
}

// Check initial staff account details.
bool validateBootstrapBody(const BootstrapBody& data) {
    return data.name.size() >= 2 &&
           data.name.size() <= 80 &&
           data.password.size() >= 8 &&
           data.password.size() <= 128 &&
           data.email.find('@') != std::string::npos;
}

// Check contact form input.
bool validateContactMessage(const ContactMessage& data) {
    return data.name.size() >= 2 &&
           data.name.size() <= 80 &&
           data.email.find('@') != std::string::npos &&
           data.message.size() >= 10 &&
           data.message.size() <= 2000;
}

// Check allowed emergency severity.
bool validatePriorityChange(const PriorityChange& data) {
    return data.severity == "Critical" ||
           data.severity == "High" ||
           data.severity == "Medium" ||
           data.severity == "Low";
}

// Check allowed review decision.
bool validateReviewDecision(const ReviewDecision& data) {
    return data.decision == "cleared" ||
           data.decision == "needs-review" ||
           data.decision == "escalated";
}

} 
} 
