export type Todo = RootTodo[];

export interface RootTodo {
    context_type: string;
    course_id: number;
    context_name: string;
    type: string;
    ignore: string;
    ignore_permanently: string;
    assignment: Assignment;
    html_url: string;
}

export interface Assignment {
    id: number;
    description?: string;
    due_at: string;
    unlock_at: any;
    lock_at: any;
    points_possible: number;
    grading_type: string;
    assignment_group_id: number;
    grading_standard_id: any;
    created_at: string;
    updated_at: string;
    peer_reviews: boolean;
    automatic_peer_reviews: boolean;
    position: number;
    grade_group_students_individually: boolean;
    anonymous_peer_reviews: boolean;
    group_category_id: any;
    post_to_sis: boolean;
    moderated_grading: boolean;
    omit_from_final_grade: boolean;
    intra_group_peer_reviews: boolean;
    anonymous_instructor_annotations: boolean;
    anonymous_grading: boolean;
    graders_anonymous_to_graders: boolean;
    grader_count: number;
    grader_comments_visible_to_graders: boolean;
    final_grader_id: any;
    grader_names_visible_to_final_grader: boolean;
    allowed_attempts: number;
    annotatable_attachment_id: any;
    hide_in_gradebook: boolean;
    suppress_assignment: boolean;
    secure_params: string;
    lti_context_id: string;
    course_id: number;
    name: string;
    submission_types: string[];
    has_submitted_submissions: boolean;
    due_date_required: boolean;
    max_name_length: number;
    in_closed_grading_period: boolean;
    graded_submissions_exist: boolean;
    is_quiz_assignment: boolean;
    can_duplicate: boolean;
    original_course_id: any;
    original_assignment_id: any;
    original_lti_resource_link_id: any;
    original_assignment_name: any;
    original_quiz_id: any;
    workflow_state: string;
    important_dates: boolean;
    muted: boolean;
    html_url: string;
    all_dates: AllDate[];
    published: boolean;
    only_visible_to_overrides: boolean;
    visible_to_everyone: boolean;
    locked_for_user: boolean;
    submissions_download_url: string;
    post_manually: boolean;
    anonymize_students: boolean;
    require_lockdown_browser: boolean;
    restrict_quantitative_data: boolean;
    lock_info?: LockInfo;
    lock_explanation?: string;
}

export interface AllDate {
    id: number;
    due_at: string;
    unlock_at: any;
    lock_at: any;
    title: string;
    set_type: string;
    set_id: number;
}

export interface LockInfo {
    asset_string: string;
    context_module: ContextModule;
}

export interface ContextModule {
    id: number;
    name: string;
    context_type: string;
    context_id: number;
    workflow_state: string;
    unlock_at: string;
}

export interface TodoItem {
    id: number;
    text: string;
    due_at?: string | null;
    created_at?: string;
    completed: boolean;
}