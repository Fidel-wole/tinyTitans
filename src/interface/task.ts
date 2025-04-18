export interface ITask {
    title: string;
    description: string;
    type: TaskType
    reward_points: number;
    is_active: boolean;
    metadata?: any;
  }
  
export enum TaskType {
    QUIZ = "quiz",
    REFER = "refer",
    JOIN_DISCORD = "join-discord",
    CUSTOM = "custom",
    COMMUNITY = "community",
    WATCH_AND_EARN = "watch_and_earn"
  }

  export interface IUserTaskProgress {
    user_id: string;
    task_id: string;
    completed: boolean;
    completed_at?: Date;
  }
  