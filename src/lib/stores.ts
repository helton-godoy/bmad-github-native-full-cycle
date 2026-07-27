import { createStore } from 'redux';

const initialState = {
  // Initial state properties
};

function rootReducer(state = initialState, action) {
  switch (action.type) {
    // Reducer cases
    default:
      return state;
  }
}

export const store = createStore(rootReducer);