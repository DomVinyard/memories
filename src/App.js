import React, { useEffect, useState, useRef } from "react";
import ls from "local-storage";
import api from "./utils/api";
import sortByDate from "./utils/sortByDate";
import isLocalHost from "./utils/isLocalHost";
import "./App.css";
import styled from "styled-components";
import { ReactMic } from "@cleandersonlobo/react-mic";

// She wasn't doing a thing that I could see,
// except standing there leaning on the balcony railing,
// holding the universe together.”

const App = () => {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  useEffect(() => {
    const fetchAll = async () => {
      // Fetch all todos
      api.readAll().then(todos => {
        if (todos.message === "unauthorized") {
          if (isLocalHost()) {
            alert(
              "FaunaDB key is not unauthorized. Make sure you set it in terminal session where you ran `npm start`. Visit http://bit.ly/set-fauna-key for more info"
            );
          } else {
            alert(
              "FaunaDB key is not unauthorized. Verify the key `FAUNADB_SERVER_SECRET` set in Netlify enviroment variables is correct"
            );
          }
          return false;
        }

        console.log("all todos", todos);
        setTodos(
          [...todos].map(todo => {
            todo.data.base64data = ls(getTodoId(todo));
            return todo;
          })
        );
        setLoading(false);
      });
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
      console.log(`deleted todo id ${todoId}`);
    } catch (e) {
      console.log(`There was an error removing ${todoId}`, e);
      // Add item removed back to list
      setTodos(
        filteredTodos.optimisticState.concat(filteredTodos.rollbackTodo)
      );
    }
  };

  const RenderTodos = () => {
    if (loading) {
      return (
        <CenterText>
          <i class="fas fa-spinner fa-pulse"></i>
        </CenterText>
      );
    }
    if (!todos || !todos.length) {
      // Loading State here
      return <CenterText>no recordings</CenterText>;
    }

    const timeStampKey = "startTime";
    const orderBy = "desc"; // or `asc`
    const sortOrder = sortByDate(timeStampKey, orderBy);
    const todosByDate = todos.sort(sortOrder);

    return (
      <div>
        {todosByDate.map((todo, i) => {
          const { data, ref } = todo;
          if (!data) return null;
          const id = getTodoId(todo);
          // only show delete button after create API response returns
          const deleteButton = ref ? (
            <button data-id={id} onClick={deleteTodo}>
              delete
            </button>
          ) : (
            <span>
              <i class="fas fa-spinner fa-pulse"></i>
            </span>
          );

          return (
            <div key={i} className="todo-item">
              <label className="todo">
                <audio controls src={data.base64data} />
              </label>
              {deleteButton}
            </div>
          );
        })}
      </div>
    );
  };

  if (isRecording) {
    return (
      <div>
        <ReactMic
          record={isRecording && isRecording !== "awaitingConfirm"}
          className="sound-wave"
          onStop={recordedBlob => {
            console.log("recordedBlob is: ", recordedBlob);
            setIsRecording(false);
            // setRecording(recordedBlob);
            saveRecording(recordedBlob);
          }}
          onData={recordedBlob =>
            console.log("chunk of real-time data is: ", recordedBlob)
          }
          strokeColor="#000000"
          backgroundColor="#FF4081"
        />
        <FixedBottomDark
          onClick={() => {
            setIsRecording("awaitingConfirm");
          }}
        >
          End Recording
        </FixedBottomDark>
      </div>
    );
  }
  return (
    <div className="app">
      <div className="todo-list">
        <RenderTodos />

        <FixedBottom>
          <MicButton onClick={() => setIsRecording(true)}>
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
