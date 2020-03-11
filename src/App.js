import React, { useEffect, useState, useRef } from "react";
import "./App.css";
import styled from "styled-components";
import { RecordRTCPromisesHandler } from "recordrtc";
import { DBConfig } from "./DBConfig";
import { initDB, useIndexedDB } from "react-indexed-db";
import cuid from "cuid";
import moment from "moment";
import ScrollableFeed from "react-scrollable-feed";
import netlifyIdentity from "netlify-identity-widget";

initDB(DBConfig);
netlifyIdentity.init();
netlifyIdentity.on("login", () => window.location.reload());
netlifyIdentity.on("logout", () => window.location.reload());

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
  const messagesEndRef = useRef(null);

  const user = netlifyIdentity.currentUser();

  // Fetch data on load

  useEffect(() => {
    const fetchAll = async () => {
      if (!user) return;
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
      console.log(messagesEndRef);
      return setIsLoading(false);
    };
    fetchAll();
  }, [user]);
  useEffect(() => {
    messagesEndRef.current && messagesEndRef.current.scrollIntoView();
  }, [isLoading, recordings]);

  // Start and stop (and save) recording

  const startRecording = async () => {
    try {
      let stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      console.log({ stream });
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

  const deleteRecording = async e => {
    const { deleteRecord } = useIndexedDB("recordings");
    const id = e.target.dataset.id;
    setRecordings(recordings.filter(recording => recording.id !== id));
    deleteRecord(id);
  };

  if (!user) {
    return (
      <PublicContainer>
        <h1>memories</h1>
        <button
          onClick={() => {
            netlifyIdentity.open();
          }}
        >
          Get started ›
        </button>
      </PublicContainer>
    );
  }

  if (isLoading) {
    return (
      <CenterText>
        <i className="fas fa-spinner fa-pulse"></i>
      </CenterText>
    );
  }

  if (isRecording) {
    return (
      <Outer className="app">
        <Inner>
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
        </Inner>
      </Outer>
    );
  }

  return (
    <Outer className="app">
      <Inner>
        <FixedTop>
          <button
            onClick={() => {
              console.log("logging out");
              netlifyIdentity.logout();
            }}
          >
            logout
          </button>
        </FixedTop>
        {!recordings || !recordings.length ? (
          <CenterText>
            <h2>no recordings</h2>click the mic to record a memory
          </CenterText>
        ) : (
          <ScrollableFeed>
            <div style={{ height: 60 }}></div>
            {recordings.filter(Boolean).map((recording, i) => {
              const { id, recordingStart, base64 } = recording;
              return (
                <RecordingContainer key={id}>
                  <div>{moment(recordingStart).fromNow()}</div>
                  <div key={id} className="todo-item">
                    <label className="todo">
                      <audio controls src={base64} />
                    </label>
                    <button data-id={id} onClick={deleteRecording}>
                      delete
                    </button>
                  </div>
                </RecordingContainer>
              );
            })}
          </ScrollableFeed>
        )}
        <div ref={messagesEndRef} />
        <FixedBottom>
          <MicButton onClick={async () => startRecording()}>
            <i className="fas fa-microphone"></i>
          </MicButton>
        </FixedBottom>
      </Inner>
    </Outer>
  );
};

const Inner = styled.div`
  margin: 0 auto;
  max-width: 500px;
`;
const Outer = styled.div``;

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
  text-align: center;
  .fa-microphone {
    font-size: 12rem;
    color: #ff4d22;
  }
`;

const RecordingContainer = styled.div`
  margin-top: 0.75rem;
`;
const FixedTop = styled.div`
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: #222;
  color: white;
  position: fixed;
  padding: 8px;
  text-align: right;
`;
const FixedBottom = styled.div`
  position: fixed;
  background: #eee;
  bottom: 0;
  left: 0;
  right: 0;
  border-top: 2px solid aaa;
  text-align: center;
`;

const FixedBottomDark = styled(FixedBottom)`
  background: #222;
  cursor: pointer;
  font-weight: bold;
  color: #fff;
  font-size: 2rem;
  padding: 18px;
`;

const MicButton = styled.div`
  background: #ff4d22;
  width: 60px;
  height: 60px;
  border-radius: 100%;
  font-size: 1.6rem;
  line-height: 60px;
  margin: 8px auto;
  cursor: pointer;
`;

const CenterText = styled.div`
  text-align: center;
  color: #acacac;
  margin-top: 40vh;
`;

const PublicContainer = styled.div`
  background: url(https://img3.goodfon.com/wallpaper/nbig/c/77/starost-skameyka.jpg);
  height: 100vh;
  background-size: cover;
  background-position: bottom right;

  text-align: center;
  h1 {
    padding-top: 33vh;
    font-family: "Pacifico", cursive;
    color: white;
    font-size: 5rem;
    margin: 0;
    padding: 0;
  }
`;
export default App;
