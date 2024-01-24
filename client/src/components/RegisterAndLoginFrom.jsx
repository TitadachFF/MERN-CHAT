import React, { useContext, useState } from "react";
import axios from "axios";
import { UserContext } from "../context/UserContext";

const RegisterAndLoginForm = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoginOrRegister, setIsLoginOrRegister] = useState("login");
  // Rename setUsername
  const { setUsername: setLoggedInUsername, setId } = useContext(UserContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = isLoginOrRegister === "register" ? "register" : "login";
    try {
      const { data } = await axios.post(url, { username, password });
      setLoggedInUsername(username);
      setId(data.id);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="bg-neutral-200 h-screen flex items-center justify-center">
      
      <div className="bg-white rounded-lg p-6 shadow-md w-[500px] mx-auto mb-12">
        <h1 className="flex justify-center  text-[30px] font-bold text-blue-500 mb-5">
          WELCOME TO MERN-CHAT
        </h1>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            className="block w-full rounded-lg p-2 mb-2 border font-thin  "
            placeholder="Username"
            onChange={(e) => setUsername(e.target.value)}
          />
          
          <input
            type="text"
            value={password}
            className="block w-full rounded-lg mt-[20px] p-2 mb-2 border font-thin"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="border-b-[1px] p-5 border-gray-300">
            <button className="bg-blue-500 text-white block w-full rounded-lg p-2  hover:bg-blue-700 font-bold mt-5	text-decoration-line: underline; ">
              {isLoginOrRegister === "register" ? "Register" : "Login"}
            </button>
          </div>
          <div className="text-center mt-5  border-gray-300 text-gray-500   ">
            {isLoginOrRegister === "register" && (
              <div>
                Already a member?{" "}
                <button
                  className="ml-1 text-blue-600 hover:text-blue-700 "
                  onClick={() => {
                    setIsLoginOrRegister("login");
                  }}
                >
                  Login here
                </button>{" "}
              </div>
            )}
            {isLoginOrRegister === "login" && (
              <div>
                Don't have an account?{" "}
                <button
                  className="ml-1 text-red-500 hover:text-blue-700 "
                  onClick={() => {
                    setIsLoginOrRegister("register");
                  }}
                >
                  Register
                </button>{" "}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterAndLoginForm;
