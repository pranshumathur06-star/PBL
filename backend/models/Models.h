
#ifndef EASE_MODELS_H
#define EASE_MODELS_H

#include <string>
#include <vector>
#include <optional>
#include <unordered_map>

namespace ease {
namespace models {

std::string generateId();
std::string utcNow();

// Location
struct Loc {
    bool manual = false;
    std::optional<std::string> address;
    std::optional<double> lat, lng, accuracy_m, map_x, map_y;
};

// Emergency report details
struct ReportDetails {
    std::optional<std::string> landmark, pin, injuries, people;
    bool immediate_danger = false;
};

// Risk information
struct RiskSignal {
    std::string id, kind, text;
    int weight = 0;
};

struct Risk {
    int score = 0;
    std::string level = "low";
    std::vector<RiskSignal> signals;
};

// Report history and replies
struct HistoryEntry {
    std::string ts = utcNow();
    std::string stage;
    std::optional<std::string> note, actor;
};

struct Reply {
    std::string id = generateId();
    std::string ts = utcNow();
    std::string by, role, text;
};

// Report creation
struct ReportCreate {
    std::string text;
    std::string category = "other";
    std::string urgency = "info";
    Loc loc;
    ReportDetails details;
    std::optional<std::string> reporter_name, phone;
};

// Complete emergency report
struct Report {
    std::string id = generateId();
    std::string code, category, label;
    std::string urgency = "info";
    std::string severity = "Low";
    std::string text;
    std::string status = "Reported";
    std::string node;

    Loc loc;
    ReportDetails details;

    std::optional<std::string> reporter_name, phone;
    std::string acct = "guest";
    std::optional<std::string> unit, route_km;
    Risk risk;

    bool needs_review = false;
    bool flag = false;
    std::optional<std::string> flag_reason, link;

    bool sample = false;
    std::string created_at = utcNow();
    std::string updated_at = utcNow();

    std::vector<HistoryEntry> hist;
    std::vector<Reply> replies;
};

struct ReportCancel {
    std::optional<std::string> phone, reason;
};

struct ReportPublic {
    std::string code, category, label, severity, status;
    std::optional<std::string> unit;
    std::string created_at = utcNow();

    std::vector<HistoryEntry> hist;
    std::vector<Reply> replies;

    std::optional<std::string> loc_note, text, node;
    bool full = false;
};

struct ReplyCreate {
    std::string text;
    std::optional<std::string> phone;
};

// Responder units
struct Unit {
    std::string id, svc, facility, node;
    std::string stat = "Available";
    std::string tags;
    bool active = true;
    bool sample = false;
};

struct UnitStatusPatch {
    std::string stat;
    std::optional<std::string> reason;
};

struct UnitActivePatch {
    bool active = true;
    std::optional<std::string> reason;
};

// Audit record
struct AuditEntry {
    std::string id = generateId();
    int n = 0;
    std::string ts = utcNow();
    std::string actor, role, action, target;

    std::optional<std::string> reason, prev, next;
    bool sample = false;
};

// Operations
struct StatusChange {
    std::string status;
    std::optional<std::string> reason;
};

struct PriorityChange {
    std::string severity;
    std::optional<std::string> reason;
};

struct AssignBody {
    std::string unit_id;
    std::optional<std::string> reason;
};

struct NoteBody {
    std::string text;
};

struct ReviewDecision {
    std::string decision;
    std::optional<std::string> note;
};

struct FlagBody {
    bool flag = false;
    std::optional<std::string> reason;
};

struct LinkBody {
    std::string other_code;
    std::optional<std::string> reason;
};

struct ReasonBody {
    std::optional<std::string> reason;
};

// Authentication
struct CitizenRegister {
    std::string name, phone, password;
};

struct CitizenOtpVerify {
    std::string name, phone, password, code;
};

struct OtpIssue {
    std::string name, phone, password;
};

struct LoginBody {
    std::string ident, password;
};

struct SessionUser {
    std::string id, type, name, role, ident;
};

struct BootstrapBody {
    std::string name, email, password;
};

struct UserAdminView {
    std::string id, type, name, role, ident;
    bool disabled = false;
    std::string created_at = utcNow();
};

struct RoleChange {
    std::string role;
    std::optional<std::string> reason;
};

struct DisableChange {
    bool disabled = false;
    std::optional<std::string> reason;
};

// Routing
struct RouteResult {
    std::string from_node, to_node;
    double distance_km = 0;
    int eta_min = 0;

    std::vector<std::string> path;
    std::vector<std::vector<double>> points;

    int settled = 0;
    double compute_ms = 0;
};

struct GraphMeta {
    double pxkm = 0;
    int node_count = 0;
    int edge_count = 0;
};

struct NearbyFacility {
    std::string name, type, node;
    double distance_km = 0;
    int eta_min = 0;
    std::string helpline;

    std::vector<std::vector<double>> points;
};

// Contact form
struct ContactMessage {
    std::string id = generateId();
    std::string name, email;
    std::optional<std::string> org;
    std::string message;
    std::string created_at = utcNow();
};

// Dashboard analytics
struct Analytics {
    int total = 0;
    int active = 0;
    int resolved = 0;

    std::unordered_map<std::string, int> by_status;
    std::unordered_map<std::string, int> by_severity;
    std::unordered_map<std::string, int> by_category;

    std::optional<double> avg_ack_min;
    int units_available = 0;
    int units_total = 0;
};

// Basic input validation
bool validateReportCreate(const ReportCreate& data);
bool validateReplyCreate(const ReplyCreate& data);
bool validateNoteBody(const NoteBody& data);
bool validateCitizenRegister(const CitizenRegister& data);
bool validateOtpIssue(const OtpIssue& data);
bool validateBootstrapBody(const BootstrapBody& data);
bool validateContactMessage(const ContactMessage& data);
bool validatePriorityChange(const PriorityChange& data);
bool validateReviewDecision(const ReviewDecision& data);

} 
}  

#endif
