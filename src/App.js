import React, { useEffect, useState } from "react";
import "./App.css";
import styled from "styled-components";
import { RecordRTCPromisesHandler } from "recordrtc";
import { DBConfig } from "./DBConfig";
import { initDB, useIndexedDB } from "react-indexed-db";
import cuid from "cuid";
import moment from "moment";

initDB(DBConfig);

// She wasn't doing a thing that I could see,
// except standing there leaning on the balcony railing,
// holding the universe together.”

function readAsDataURLAsync(blob) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const App = () => {
  const [recordings, setRecordings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState();
  const [recordingStart, setRecordingStart] = useState(false);
  const [timestamp, setTimestamp] = useState(false);
  const startRecording = async () => {
    try {
      let stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      console.log({ stream });
      // alert(JSON.stringify(stream));
      const newRecorder = new RecordRTCPromisesHandler(stream, {
        type: "audio",
        timeSlice: 1000,
        onTimeStamp: timestamp => {
          setTimestamp(timestamp);
          console.log({ timestamp, recordingStart });
        }
      });
      setRecorder(newRecorder);
      newRecorder.startRecording();
      setRecordingStart(new Date());
      setIsRecording(true);
    } catch (err) {
      console.log("Uh oh... unable to get stream...", err);
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stopRecording();
      let blob = await recorder.getBlob();
      const recordingEnd = new Date();
      const length = recordingEnd - recordingStart;
      const newRecordingID = cuid();
      const recording = {
        id: newRecordingID,
        blob,
        recordingStart,
        recordingEnd,
        length
      };
      const { add } = useIndexedDB("recordings");
      add(recording, newRecordingID);
      setRecordings([
        ...recordings,
        {
          id: newRecordingID,
          ...recording,
          base64: await readAsDataURLAsync(blob)
        }
      ]);
      setIsRecording(false);
      setRecordingStart(false);
      setTimestamp(false);
    } catch (error) {
      console.log(error);
    }
  };
  useEffect(() => {
    const fetchAll = async () => {
      const { getAll } = useIndexedDB("recordings");
      const recordings = await getAll();
      let newRecordings = [];
      for (const recording of recordings) {
        newRecordings.push({
          ...recording,
          base64: await readAsDataURLAsync(recording.blob)
        });
      }
      setRecordings(newRecordings);
      return setIsLoading(false);
    };
    fetchAll();
  }, []);

  const deleteTodo = async e => {
    const { deleteRecord } = useIndexedDB("recordings");
    const id = e.target.dataset.id;
    setRecordings(recordings.filter(recording => recording.id !== id));
    deleteRecord(id);
  };

  if (isLoading) {
    return (
      <CenterText>
        <i className="fas fa-spinner fa-pulse"></i>
      </CenterText>
    );
  }

  if (isRecording) {
    return (
      <div>
        <BigMic>
          <i className="fas fa-microphone"></i>{" "}
          <TimeStamp>
            {timestamp && recordingStart && timestamp - recordingStart > 0
              ? moment(timestamp - recordingStart).format("mm:ss")
              : "00:00"}
          </TimeStamp>
        </BigMic>
        <FixedBottomDark onClick={() => stopRecording()}>
          End Recording
        </FixedBottomDark>
      </div>
    );
  }
  return (
    <div className="app">
      <div className="todo-list">
        {!recordings || !recordings.length ? (
          <CenterText>no recordings</CenterText>
        ) : (
          <div>
            {recordings.filter(Boolean).map((recording, i) => {
              const { id, recordingStart, base64 } = recording;
              // only show delete button after create API response returns
              return (
                <RecordingContainer key={id}>
                  <div>{moment(recordingStart).fromNow()}</div>
                  <div key={id} className="todo-item">
                    <label className="todo">
                      <audio controls src={base64} />
                    </label>
                    <button data-id={id} onClick={deleteTodo}>
                      delete
                    </button>
                  </div>
                </RecordingContainer>
              );
            })}
          </div>
        )}
        <FixedBottom>
          <MicButton onClick={async () => startRecording()}>
            <i className="fas fa-microphone"></i>
          </MicButton>
        </FixedBottom>
      </div>
    </div>
  );
};

export default App;

const TimeStamp = styled.div`
  text-align: center;
  font-size: 2rem;
`;
const BigMic = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
  text-align: center;
  .fa-microphone {
    font-size: 12rem;
    color: #ff4d22;
  }
`;

const RecordingContainer = styled.div`
  margin-top: 0.75rem;
`;
const FixedBottom = styled.div`
  position: fixed;
  background: #eee;
  bottom: 0;
  left: 0;
  right: 0;
  border-top: 2px solid black;
  text-align: center;
`;

const FixedBottomDark = styled(FixedBottom)`
  background: #222;
  cursor: pointer;
  font-weight: bold;
  color: #fff;
  font-size: 2rem;
  padding: 8px;
`;

const MicButton = styled.div`
  background: #ff4d22;
  width: 40px;
  height: 40px;
  border-radius: 100%;
  font-size: 1.5rem;
  line-height: 40px;
  margin: 8px auto;
  cursor: pointer;
`;

const CenterText = styled.div`
  text-align: center;
  color: #acacac;
  margin-top: 40vh;
`;
