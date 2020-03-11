import React, { useEffect, useState, useRef } from "react";
import ls from "local-storage";
import api from "./utils/api";
import isLocalHost from "./utils/isLocalHost";
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
  const [todos, setTodos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState();
  const [recordingStart, setRecordingStart] = useState();
  const startRecording = async () => {
    try {
      let stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      const newRecorder = new RecordRTCPromisesHandler(stream, {
        type: "audio"
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
    } catch (error) {
      console.log(error);
    }
  };
  useEffect(() => {
    const fetchAll = async () => {
      const { getAll } = useIndexedDB("recordings");
      const recordings = await getAll();
      console.log(recordings);
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
  const saveRecording = async recordingValue => {
    if (!recordingValue) {
      alert("no recording");
      return false;
    }
    const recordingInfo = {
      ...recordingValue,
      completed: false
    };

    var reader = new FileReader();
    reader.readAsDataURL(recordingValue.blob);
    reader.onloadend = async () => {
      try {
        const base64data = reader.result;
        // Optimistically add todo to UI
        const optimisticRecordingsState = [
          ...todos,
          {
            data: { ...recordingInfo, base64data },
            ts: new Date().getTime() * 10000
          }
        ];
        console.log({ optimisticRecordingsState });
        setTodos(optimisticRecordingsState);
        const newItem = await api.create(recordingInfo);
        const newId = getTodoId(newItem);
        ls(newId, base64data);
        newItem.data.base64data = base64data;
        // remove temporaryValue from state and persist API response
        const persistedState = removeOptimisticTodo(todos).concat(newItem);
        // Set persisted value to state
        setTodos(persistedState);
        console.log({ persistedState });
      } catch (e) {
        console.log("An API error occurred", e);
        const revertedState = removeOptimisticTodo(todos);
        // // Reset to original state
        setTodos(revertedState);
      }
    };

    // Make API request to create new todo
  };

  const deleteTodo = async e => {
    console.log("delete me");
    const { deleteRecord } = useIndexedDB("recordings");
    const id = e.target.dataset.id;
    setRecordings(recordings.filter(recording => recording.id !== id));
    deleteRecord(id);
    return;
    const todoId = e.target.dataset.id;

    // Optimistically remove todo from UI
    const filteredTodos = todos.reduce(
      (acc, current) => {
        const currentId = getTodoId(current);
        if (currentId === todoId) {
          // save item being removed for rollback
          acc.rollbackTodo = current;
          return acc;
        }
        // filter deleted todo out of the todos list
        acc.optimisticState = acc.optimisticState.concat(current);
        return acc;
      },
      {
        rollbackTodo: {},
        optimisticState: []
      }
    );

    setTodos(filteredTodos.optimisticState);

    // Make API request to delete todo
    try {
      await api.delete(todoId);
      ls.remove(todoId);
      console.log(`deleted todo id ${todoId}`);
    } catch (e) {
      console.log(`There was an error removing ${todoId}`, e);
      // Add item removed back to list
      setTodos(
        filteredTodos.optimisticState.concat(filteredTodos.rollbackTodo)
      );
    }
  };

  if (isLoading) {
    return (
      <CenterText>
        <i class="fas fa-spinner fa-pulse"></i>
      </CenterText>
    );
  }

  if (!recordings || !recordings.length) {
    // Loading State here
    return <CenterText>no recordings</CenterText>;
  }

  if (isRecording) {
    return (
      <div>
        <div>recording </div>
        <FixedBottomDark onClick={() => stopRecording()}>
          End Recording
        </FixedBottomDark>
      </div>
    );
  }
  return (
    <div className="app">
      <div className="todo-list">
        <div>
          {recordings.filter(Boolean).map((recording, i) => {
            const { id, recordingStart, base64 } = recording;
            console.log({ recording });
            // only show delete button after create API response returns
            return (
              <RecordingContainer>
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

        <FixedBottom>
          <MicButton
            onClick={async () => {
              startRecording();
            }}
          >
            <i class="fas fa-microphone"></i>
          </MicButton>
        </FixedBottom>
      </div>
    </div>
  );
};

function removeOptimisticTodo(todos) {
  // return all 'real' todos
  return todos.filter(todo => {
    return todo.ref;
  });
}

function getTodoId(todo) {
  if (!todo.ref) {
    return null;
  }
  return todo.ref["@ref"].id;
}

export default App;

const RecordingContainer = styled.div`
  margin-top: 1rem;
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
