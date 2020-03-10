import React, { useEffect, useState, useRef } from "react";
import ContentEditable from "./components/ContentEditable";
import SettingsMenu from "./components/SettingsMenu";
import SettingsIcon from "./components/SettingsIcon";
import api from "./utils/api";
import sortByDate from "./utils/sortByDate";
import isLocalHost from "./utils/isLocalHost";
import "./App.css";
import styled from "styled-components";
import { ReactMic } from "@cleandersonlobo/react-mic";
import AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";

const App = () => {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const inputElement = useRef(null);
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
        setTodos(todos);
        setLoading(false);
      });
    };
    fetchAll();
  }, []);
  const saveRecording = async recordingValue => {
    if (!saveRecording) {
      alert("no recording");
      return false;
    }
    const recordingInfo = {
      ...recordingValue,
      completed: false
    };

    // Optimistically add todo to UI
    const optimisticRecordingsState = [
      ...todos,
      {
        data: recordingInfo,
        ts: new Date().getTime() * 10000
      }
    ];
    setTodos(optimisticRecordingsState);

    var reader = new FileReader();
    reader.readAsDataURL(recordingValue.blob);
    reader.onloadend = async () => {
      var base64data = reader.result;
      console.log(base64data);
      try {
        recordingInfo.base64data = base64data;
        const response = await api.create(recordingInfo);

        console.log({ response });
        // remove temporaryValue from state and persist API response
        const persistedState = removeOptimisticTodo(todos).concat(response);
        // Set persisted value to state
        setTodos(persistedState);
      } catch (e) {
        console.log("An API error occurred", e);
        // const revertedState = removeOptimisticTodo(todos);
        // // Reset to original state
        // setTodos(revertedState);
      }
    };

    // Make API request to create new todo
  };

  const deleteTodo = e => {
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
    api
      .delete(todoId)
      .then(() => {
        console.log(`deleted todo id ${todoId}`);
      })
      .catch(e => {
        console.log(`There was an error removing ${todoId}`, e);
        // Add item removed back to list
        setTodos(
          filteredTodos.optimisticState.concat(filteredTodos.rollbackTodo)
        );
      });
  };

  const updateTodoTitle = (event, currentValue) => {
    let isDifferent = false;
    const todoId = event.target.dataset.key;

    const updatedTodos = todos.map((todo, i) => {
      const id = getTodoId(todo);
      if (id === todoId && todo.data.title !== currentValue) {
        todo.data.title = currentValue;
        isDifferent = true;
      }
      return todo;
    });

    // only set state if input different
    if (isDifferent) {
      setTodos(updatedTodos);

      api
        .update(todoId, {
          title: currentValue
        })
        .then(() => {
          console.log(`update todo ${todoId}`, currentValue);
        })
        .catch(e => {
          console.log("An API error occurred", e);
        });
    }
  };
  const clearCompleted = () => {
    // Optimistically remove todos from UI
    const data = todos.reduce(
      (acc, current) => {
        if (current.data.completed) {
          // save item being removed for rollback
          acc.completedTodoIds = acc.completedTodoIds.concat(
            getTodoId(current)
          );
          return acc;
        }
        // filter deleted todo out of the todos list
        acc.optimisticState = acc.optimisticState.concat(current);
        return acc;
      },
      {
        completedTodoIds: [],
        optimisticState: []
      }
    );

    // only set state if completed todos exist
    if (!data.completedTodoIds.length) {
      alert("Please check off some todos to batch remove them");
      closeModal();
      return false;
    }
    setTodos(data.optimisticState);

    setTimeout(() => {
      closeModal();
    }, 600);

    api
      .batchDelete(data.completedTodoIds)
      .then(() => {
        console.log(`Batch removal complete`, data.completedTodoIds);
      })
      .catch(e => {
        console.log("An API error occurred", e);
      });
  };
  const closeModal = e => {
    setShowMenu(false);
  };
  const openModal = () => {
    setShowMenu(true);
  };
  const RenderTodos = () => {
    if (loading) {
      return "loading";
    }
    if (!todos || !todos.length) {
      // Loading State here
      return "no recordings";
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

      <SettingsMenu
        showMenu={showMenu}
        handleModalClose={closeModal}
        handleClearCompleted={clearCompleted}
      />
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
