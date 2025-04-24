import React, { useRef, useState, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import axios from "axios";

export default function BlinkDetector() {
  const webcamRef = useRef(null);
  const earFramesRef = useRef(0);

  const [message, setMessage] = useState("Waiting for you to blink...");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [blinked, setBlinked] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null); // null | "matched" | "unmatched" | "error"

  const EAR_THRESHOLD = 0.25;
  const EAR_CONSEC_FRAMES = 4;

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = "/models";
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(`${MODEL_URL}/tiny_face_detector`),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(`${MODEL_URL}/face_landmark_68_tiny`)
      ]);
      setModelsLoaded(true);
    };
    loadModels();
  }, []);

  const getEAR = (landmarks, leftEyeIndices, rightEyeIndices) => {
    const getDistance = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const calcEAR = (eye) => {
      const A = getDistance(eye[1], eye[5]);
      const B = getDistance(eye[2], eye[4]);
      const C = getDistance(eye[0], eye[3]);
      return (A + B) / (2.0 * C);
    };
    const leftEye = leftEyeIndices.map(i => landmarks[i]);
    const rightEye = rightEyeIndices.map(i => landmarks[i]);
    return (calcEAR(leftEye) + calcEAR(rightEye)) / 2.0;
  };

  // const triggerBlink = useCallback(() => {
  //   setCooldown(true);
  //   setBlinked(true);
  //   setIsVerifying(true);
  //   setMessage("Blink detected! Verifying...");

  //   let progressInterval = 0;
  //   const interval = setInterval(() => {
  //     if (progressInterval < 100) {
  //       setProgress(progressInterval);
  //       progressInterval += 5;
  //     }
  //   }, 500);

  //   captureAndSendImage().finally(() => {
  //     setTimeout(() => {
  //       clearInterval(interval);
  //       setProgress(100);
  //       setTimeout(() => {
  //         setIsVerifying(false);
  //         setCooldown(false);
  //       }, 1000);
  //     }, 3000);
  //   });
  // }, []);

  const triggerBlink = useCallback(() => {
    setCooldown(true);
    setBlinked(true);
    setIsVerifying(true);
    setMessage("Blink detected! Verifying...");
  
    let progressValue = 0;
    const duration = 3000; // total duration for full progress
    const intervalTime = 50; // update every 50ms for smooth animation
    const increment = (100 * intervalTime) / duration;
  
    const interval = setInterval(() => {
      progressValue += increment;
      if (progressValue >= 100) {
        progressValue = 100;
        clearInterval(interval);
      }
      setProgress(progressValue);
    }, intervalTime);
  
    captureAndSendImage().finally(() => {
      setTimeout(() => {
        setProgress(100);
        setTimeout(() => {
          setIsVerifying(false);
          setCooldown(false);
        }, 1000);
      }, 3000);
    });
  }, []);

  useEffect(() => {
    let animationId;

    const detect = async () => {
      if (!modelsLoaded || !webcamRef.current || webcamRef.current.video.readyState !== 4) {
        animationId = requestAnimationFrame(detect);
        return;
      }

      if (blinked || isVerifying || cooldown || verificationResult) {
        animationId = requestAnimationFrame(detect);
        return;
      }

      const video = webcamRef.current.video;

      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }))
        .withFaceLandmarks(true);   
      // const detection = await faceapi
      //   .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }))
      //   .withFaceLandmarks(true);

      // if (!detection?.landmarks) {
      //   console.log("No landmarks detected");
      //   animationId = requestAnimationFrame(detect);
      //   return;
      // }
      // safe to use detection.landmarks now


      

      if (detection?.landmarks) {
        const landmarks = detection.landmarks.positions;
        const leftEyeIndices = [36, 37, 38, 39, 40, 41];
        const rightEyeIndices = [42, 43, 44, 45, 46, 47];
        const ear = getEAR(landmarks, leftEyeIndices, rightEyeIndices);

        console.log("EAR:", ear);

        if (ear < EAR_THRESHOLD) {
          earFramesRef.current += 1;
        } else {
          if (earFramesRef.current >= EAR_CONSEC_FRAMES) {
            triggerBlink();
          }
          earFramesRef.current = 0;
        }
      }

      animationId = requestAnimationFrame(detect);
    };

    animationId = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(animationId);
  }, [modelsLoaded, blinked, isVerifying, cooldown, verificationResult, triggerBlink]);

  const captureAndSendImage = async () => {
    const imageSrc = webcamRef.current.getScreenshot();
    try {
      const res = await axios.post("http://localhost:5000/verify", { image: imageSrc });
      const result = res.data.result; // "matched" or "unmatched"
      setVerificationResult(result);
      setMessage(result === "matched" ? "Face matched " : "Face not matched  Please restart.");
    } catch (err) {
      console.error(err);
      setVerificationResult("error");
      setMessage("Verification failed Please try again.");
    }
  };

  const handleRestart = () => {
    setBlinked(false);
    setProgress(0);
    setVerificationResult(null);
    setMessage("Waiting for you to blink...");
  };

  return (
    <div className="text-center">
      <h2 className="text-xl font-bold mb-4">{message}</h2>
      {(!verificationResult || verificationResult === "matched") && (
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          width={320}
          height={240}
          videoConstraints={{
            width: 320,
            height: 240,
            facingMode: "user",
          }}
        />
      )}
      <p className="mt-2 text-gray-600">
        {blinked && !verificationResult
          ? "Thanks! Verification in progress..."
          : verificationResult === "unmatched" || verificationResult === "error"
            ? "Please click Restart and try again."
            : "Please blink to mark your attendance."}
      </p>
      {blinked && (
        <div className="mt-4">
          <div className="w-full bg-gray-300 rounded-full h-2.5">
            <div
              className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
      {(verificationResult === "unmatched" || verificationResult === "error") && (
        <button
          className="mt-6 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          onClick={handleRestart}
        >
          Restart
        </button>
      )}
    </div>
  );
}
