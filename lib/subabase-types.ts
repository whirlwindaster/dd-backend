export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      game: {
        Row: {
          board_setup_num: number;
          demo_timeout: number;
          id: number;
          num_rounds: number;
          post_bid_timeout: number;
          pre_bid_timeout: number;
          time_created: string | null;
          time_started: string | null;
        };
        Insert: {
          board_setup_num?: number;
          demo_timeout?: number;
          id?: number;
          num_rounds?: number;
          post_bid_timeout?: number;
          pre_bid_timeout?: number;
          time_created?: string | null;
          time_started?: string | null;
        };
        Update: {
          board_setup_num?: number;
          demo_timeout?: number;
          id?: number;
          num_rounds?: number;
          post_bid_timeout?: number;
          pre_bid_timeout?: number;
          time_created?: string | null;
          time_started?: string | null;
        };
        Relationships: [];
      };
      player: {
        Row: {
          game_id: number;
          id: number;
          is_host: boolean;
          name: string | null;
          uuid: string;
        };
        Insert: {
          game_id: number;
          id?: number;
          is_host?: boolean;
          name?: string | null;
          uuid?: string;
        };
        Update: {
          game_id?: number;
          id?: number;
          is_host?: boolean;
          name?: string | null;
          uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
