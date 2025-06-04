export type MeetingTranscript = {
  meetingId: string;
  createdAt: Date;
  segments: Segment[];
};

export type Segment = {
  start: number;
  end: number;
  text: string;
  speaker: string;
};
export type MeetingSummaryInput = {
  meetingId: string;
  generatedAt: Date;
  summaryText: string;
  model: "gpt-4-turbo" | string;
};
/*
    export type MediaAsset = {
    meetingId: string;
    createdAt: Date;
    type: 'audio' | 'video';
    storagePath: string;
    durationSec: number;
    };*/
